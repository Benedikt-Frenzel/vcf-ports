export function filterRows(rows, filters) {
  const terms = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (filters.product && row.productId !== filters.product) return false;
    if (filters.release && !row.releases.some(r => r.id === filters.release)) return false;
    for (const key of ['protocol', 'classification', 'source', 'destination']) {
      if (filters[key] && row[key] !== filters[key]) return false;
    }
    const text = [row.product, row.port, row.protocol, row.source, row.destination, row.purpose, row.serviceDescription, row.classification, ...row.releases.map(r => r.name)].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function toCSV(rows) {
  const keys = ['product', 'releases', 'source', 'destination', 'port', 'protocol', 'purpose', 'serviceDescription', 'classification', 'id', 'publishDate'];
  return '\uFEFF' + [keys.map(csvCell).join(','), ...rows.map(r => keys.map(k => csvCell(k === 'releases' ? r.releases.map(v => v.name).join('; ') : r[k])).join(','))].join('\r\n');
}
// Sort a copy: presentation order must not mutate the snapshot or CSV data.
export function sortRows(rows, key = 'product', direction = 'asc') {
  const supported = ['product', 'source', 'destination', 'port', 'protocol'];
  if (!supported.includes(key)) return [...rows];
  return [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'en', {numeric:true}) * (direction === 'desc' ? -1 : 1));
}
export function matrixAxes(rows, order = 'activity') {
  return ['source', 'destination'].map(key => {
    const totals = new Map();
    for (const row of rows) totals.set(row[key], (totals.get(row[key]) || 0) + 1);
    return [...totals.keys()].sort((a, b) =>
      (order === 'activity' ? totals.get(b) - totals.get(a) : 0) || a.localeCompare(b, 'en', {numeric:true}));
  });
}
// Internet domains: extracted from endpoint labels and service descriptions.
// The pattern requires a dotted FQDN with a known generic TLD, so version
// numbers ("9.1") and article references ("KB 327186") never match.
const FQDN_PATTERN = /(?<![\w-])(\*\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|io|net|org|dev|ai|cloud|app|gov|edu))(?![\w-])/gi;
const TLDS = new Set(['com','io','net','org','dev','ai','cloud','app','gov','edu']);
export function domainOwner(domain) {
  // VMware is a Broadcom division, and Lastline was acquired by VMware, so
  // legacy lastline.com services (vDefend ATP cloud) group under VMware
  // rather than under third-party domains.
  if (/(^|\.)broadcom\.com$/i.test(domain)) return 'broadcom';
  if (/(^|\.)vmware\.com$/i.test(domain) || /(^|\.)lastline\.com$/i.test(domain)) return 'vmware';
  return 'other';
}
export function domainsInText(text) {
  const found = new Set();
  for (const match of String(text ?? '').matchAll(FQDN_PATTERN)) found.add(((match[1] || '') + match[2]).toLowerCase());
  return found;
}
export function externalDomains(rows) {
  const map = new Map();
  for (const row of rows) {
    const inLabels = new Set([...domainsInText(row.source), ...domainsInText(row.destination)]);
    const inDescriptions = domainsInText(row.serviceDescription);
    if (!inLabels.size && !inDescriptions.size) continue;
    for (const domain of new Set([...inLabels, ...inDescriptions])) {
      const entry = map.get(domain) || {domain, owner: domainOwner(domain), label: false, description: false, records: new Set(), ports: new Set(), products: new Set()};
      if (inLabels.has(domain)) entry.label = true;
      if (inDescriptions.has(domain)) entry.description = true;
      entry.records.add(row.id);
      entry.ports.add(`${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`);
      entry.products.add(row.product);
      map.set(domain, entry);
    }
  }
  return [...map.values()]
    .map(entry => ({...entry, records: entry.records.size, ports: [...entry.ports].sort((a,b)=>a.localeCompare(b,'en',{numeric:true})), products: [...entry.products].sort()}))
    .sort((a,b) => a.domain.localeCompare(b.domain));
}
// ---------- Environment mapping: firewall templates for network admins ----------
// Extracts hostnames, IP pools, and subnets from a VCF 9.x installer JSON
// (e.g. the lamw/vcf-91-in-box config format). Credentials and passwords in
// the pasted JSON are never read — only addressing is extracted.
function networkSubnets(config, type) {
  return (config.networkSpecs || []).filter(n => n.networkType === type && n.subnet).map(n => n.subnet);
}
export function parseInstallerConfig(text) {
  const config = JSON.parse(text);
  const collected = new Map();
  const add = (component, ...values) => {
    const list = collected.get(component) || [];
    for (const value of values) if (value) list.push(String(value).trim());
    if (list.length) collected.set(component, list);
  };
  for (const host of config.hostSpecs || []) add('esx', host.hostname);
  add('esx', ...networkSubnets(config, 'VMOTION'));
  add('vsan', ...networkSubnets(config, 'VSAN'));
  add('management', ...networkSubnets(config, 'MANAGEMENT'), ...networkSubnets(config, 'VM_MANAGEMENT'));
  const vsp = config.vspClusterSpec || {};
  add('management', vsp.platformFqdn, vsp.instanceFqdn, vsp.fleetFqdn,
    vsp.ipv4Pool?.ipRange && `${vsp.ipv4Pool.ipRange.startIpAddress}-${vsp.ipv4Pool.ipRange.endIpAddress}`,
    config.fleetLcmSpec?.hostname, config.sddcLcmSpec?.hostname);
  const automation = config.vcfAutomationSpec || {};
  add('automation', automation.hostname, automation.platformFqdn, ...(automation.ipPool || []));
  const nsx = config.nsxtSpec || {};
  add('nsx', nsx.vipFqdn, ...(nsx.nsxtManagers || []).map(n => n.hostname),
    ...(nsx.ipAddressPoolSpec?.subnets || []).map(s => s.cidr));
  const operations = config.vcfOperationsSpec || {};
  add('operations', ...(operations.nodes || []).map(n => n.hostname), config.vcfOperationsCollectorSpec?.hostname);
  add('licensing', config.licenseServerSpec?.hostname);
  add('identity', config.vidbSpec?.hostname);
  add('vcenter', config.vcenterSpec?.vcenterHostname);
  add('sddc', config.sddcManagerSpec?.hostname);
  add('infrastructure', ...(config.dnsSpec?.nameservers || []), ...(config.ntpServers || []));
  const mapping = {};
  for (const [component, values] of collected) mapping[component] = [...new Set(values)].join(', ');
  return mapping;
}
const BIDIRECTIONAL = /both|bi[- ]?directional/i;
export function isBidirectional(classifications) {
  return [...classifications].some(value => BIDIRECTIONAL.test(value || ''));
}
function templateAddress(mapping, componentId, names) {
  const value = (mapping || {})[componentId];
  if (value) return value;
  return `<${names[componentId] || componentId} IPs / FQDNs>`;
}
export function toFirewallCSV(rules, mapping, names) {
  const keys = ['Source address', 'Destination address', 'Port', 'Protocol', 'Bi-directional', 'Purpose', 'Classification', 'Records', 'Source component', 'Destination component'];
  const lines = [keys.map(csvCell).join(',')];
  for (const rule of rules) {
    lines.push([
      templateAddress(mapping, rule.source, names),
      templateAddress(mapping, rule.destination, names),
      rule.port || 'Not specified',
      rule.protocol || 'Not specified',
      isBidirectional(rule.classifications) ? 'yes' : 'no',
      [...rule.purposes][0] || 'Not specified',
      [...rule.classifications].join('; '),
      rule.records,
      names[rule.source] || rule.source,
      names[rule.destination] || rule.destination,
    ].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}
export function toFirewallMarkdown(rules, mapping, names, meta = {}) {
  const cell = value => String(value ?? '').replaceAll('|', '\\|');
  const rows = rules.map(rule => `| ${cell(templateAddress(mapping, rule.source, names))} | ${cell(templateAddress(mapping, rule.destination, names))} | ${cell(rule.port || 'Not specified')} | ${cell(rule.protocol || 'Not specified')} | ${isBidirectional(rule.classifications) ? 'yes' : 'no'} | ${cell([...rule.purposes][0] || 'Not specified')} | ${rule.records} |`);
  return [
    `# VCF 9.1 firewall request`,
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} from the VCF Ports communication explorer.`,
    meta.snapshot ? `Snapshot: ${meta.snapshot} (${meta.rows ?? rules.reduce((total, rule) => total + rule.records, 0)} published entries).` : '',
    mapping && Object.keys(mapping).length ? 'Addresses come from the browser-local environment mapping; `<Component> IPs / FQDNs>` marks gaps to fill in.' : 'All addresses are placeholders — map your environment first or replace them with your values.',
    '',
    'Planning aid only: validate every rule against current product documentation and your deployment before applying it. Counts are published source entries, not deduplicated firewall rules.',
    '',
    '| Source | Destination | Port | Protocol | Bi-directional | Purpose | Records |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].filter(line => line !== '').join('\n');
}
export function matrixCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!counts.has(row.source)) counts.set(row.source, new Map());
    const destinations = counts.get(row.source);
    destinations.set(row.destination, (destinations.get(row.destination) || 0) + 1);
  }
  return counts;
}
