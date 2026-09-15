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
export function matrixCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!counts.has(row.source)) counts.set(row.source, new Map());
    const destinations = counts.get(row.source);
    destinations.set(row.destination, (destinations.get(row.destination) || 0) + 1);
  }
  return counts;
}
