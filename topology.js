// Logical presentation aliases for the topology. Source endpoint text is never changed.
import { domainsInText } from './logic.js';
export const COMPONENTS = [
  {id:'automation', name:'VCF Automation', zone:'Fleet services', x:70, y:64, w:245},
  {id:'operations', name:'VCF Operations', zone:'Fleet services', x:335, y:64, w:245},
  {id:'logs', name:'VCF Operations for Logs', zone:'Fleet services', x:600, y:64, w:245},
  {id:'networks', name:'Operations for Networks', zone:'Fleet services', x:865, y:64, w:245},
  {id:'hcx', name:'VCF Operations HCX', zone:'Fleet services', x:1130, y:64, w:245},
  {id:'management', name:'VCF Management Services', zone:'Management domain', x:70, y:248, w:200},
  {id:'sddc', name:'SDDC Manager', zone:'Management domain', x:285, y:248, w:200},
  {id:'vcenter', name:'vCenter', zone:'Management domain', x:500, y:248, w:200},
  {id:'depot', name:'Software Depot', zone:'Management domain', x:715, y:248, w:175},
  {id:'identity', name:'Identity Broker', zone:'Management domain', x:70, y:352, w:260},
  {id:'licensing', name:'License Hub / Server', zone:'Management domain', x:350, y:352, w:260},
  {id:'installer', name:'VCF Installer', zone:'Management domain', x:630, y:352, w:260},
  {id:'nsx', name:'NSX', zone:'Workload infrastructure', x:70, y:606, w:190},
  {id:'esx', name:'ESX Hosts', zone:'Workload infrastructure', x:280, y:606, w:190},
  {id:'vsan', name:'vSAN', zone:'Workload infrastructure', x:490, y:606, w:190},
  {id:'supervisor', name:'Supervisor / Kubernetes', zone:'Workload infrastructure', x:700, y:606, w:190},
  {id:'private-ai', name:'Private AI Services', zone:'Advanced services', x:990, y:235, w:225},
  {id:'dsm', name:'DSM Data Services', zone:'Advanced services', x:1235, y:235, w:225},
  {id:'avi', name:'Avi Load Balancer', zone:'Advanced services', x:990, y:350, w:225},
  {id:'vdefend', name:'vDefend', zone:'Advanced services', x:1235, y:350, w:225},
  {id:'recovery', name:'Protection & Recovery', zone:'Advanced services', x:1110, y:465, w:225},
  {id:'clients', name:'Clients & Administrators', zone:'External systems', x:350, y:829, w:330},
  {id:'infrastructure', name:'Infrastructure & External Services', zone:'External systems', x:820, y:829, w:330}
];
export const ENVIRONMENT_SERVICES = [
  {id:'external-dns', name:'DNS Servers', pattern:/\bDNS (?:Resolvers|server)\b/i},
  {id:'external-ntp', name:'NTP / Time Servers', pattern:/\bNTP Servers?\b|\bNTS\b|Precision Time Protocol/i},
  {id:'external-dhcp', name:'DHCP Servers', pattern:/\bDHCP(?:v[46])? Server\b/i},
  {id:'external-directory', name:'Directory / Identity Services', pattern:/Active Directory|User Identity Provider|LDAP \(server\)|TACACS\+ Server/i},
  {id:'external-syslog', name:'Syslog Servers', pattern:/\bSyslog\b/i},
  {id:'external-mail', name:'Email Servers', pattern:/\bEmail Server\b/i},
  {id:'external-snmp', name:'SNMP Management', pattern:/\bSNMP Management System\b/i},
  {id:'external-storage', name:'External Storage / Backup', pattern:/NFS [Ss]torage|iSCSI Storage|S3-compatible [Ss]torage|Scale-out Cloud File System|Backup Servers|SFTP backup server/i}
];
export function environmentKeyForEndpoint(endpoint, componentId = componentForEndpoint(endpoint)) {
  return ENVIRONMENT_SERVICES.find(service => service.pattern.test(String(endpoint || '')))?.id || componentId;
}
const rules = [
  {id:'networks', pattern:/operations for networks|\bvrni\b|network insight/i},
  {id:'logs', pattern:/operations for logs|log insight|log assist|log source|clickhouse|cplf/i},
  {id:'hcx', pattern:/\bhcx\b|interconnect \(|network extension|sentinel (gateway|data|agent)/i},
  {id:'operations', pattern:/vcf operations|\bvrops\b|cloud proxy|operations collector|collector$/i},
  {id:'automation', pattern:/vcf automation|salt (raas|master)/i},
  {id:'identity', pattern:/identity broker|identity provider|active directory|\bldap\b/i},
  {id:'private-ai', pattern:/\bmps\b|aiplatform|intelligent.assist|ai\.azure|mcp server|otel collector|nvidia/i},
  {id:'dsm', pattern:/\bdsm\b|database cluster|postgres/i},
  {id:'recovery', pattern:/protection and recovery|vsphere replication|cyber recovery|live recovery/i},
  {id:'avi', pattern:/\bavi\b|service engine|load balancer data plane|pool application/i},
  {id:'vdefend', pattern:/vdefend|lastline|anonvpn|\bssp\b|sandbox (vcenter|esx)/i},
  {id:'depot', pattern:/software depot/i},
  {id:'licensing', pattern:/license hub|license server/i},
  {id:'installer', pattern:/\bvcf installer\b/i},
  {id:'management', pattern:/vcf management services|\bvmsp\b|\blcm\b/i},
  {id:'sddc', pattern:/sddc manager/i},
  {id:'vsan', pattern:/\bvsan\b|vasa\/vvol|rdma storage/i},
  {id:'nsx', pattern:/\bnsx\b|host transport node|geneve|external routing peers|ipsec peers/i},
  {id:'vcenter', pattern:/vcenter|\bvcsa\b|enhanced linked mode|\bvcha\b|^vc$/i},
  {id:'supervisor', pattern:/supervisor|kubernetes|\bvks\b|\btkgi\b|antrea|service ip pool/i},
  {id:'esx', pattern:/\besx\b|\besxi\b|vmotion|nfs ip addresses|iscsi ip addresses/i},
  {id:'clients', pattern:/workstation|management client|administration system|web browser|ui client|api client|user \/ client|site recovery ui|application client|backup server/i}
];
const VMSP_PLATFORM = /VCF Management Services Platform/i;
// Why a published endpoint label lands on a diagram box. Rule order is the
// assignment order: the first match wins, and explicit internet domains never
// enter the product rules.
export function explainEndpoint(endpoint) {
  const text = String(endpoint || '');
  const domains = [...domainsInText(text)];
  if (domains.length) return {componentId:'infrastructure', kind:'internet-domain', matched:domains.join(', ')};
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) return {componentId:rule.id, kind:'label', matched:match[0]};
  }
  return {componentId:'infrastructure', kind:'unmatched', matched:''};
}
function applyProductBoundary(alias, endpoint, product) {
  // The VCF Automation release contains VMSP records as part of its service
  // boundary. Keep the same endpoint under Management Services for every other
  // product, but present it as Automation when the owning product is Automation.
  if (product === 'VCF Automation' && alias.componentId === 'management' && VMSP_PLATFORM.test(endpoint))
    return {...alias, componentId:'automation', kind:'product-boundary', previousComponentId:'management'};
  return alias;
}
export function explainPath(row) {
  const source = applyProductBoundary(explainEndpoint(row.source), row.source, row.product);
  const destination = applyProductBoundary(explainEndpoint(row.destination), row.destination, row.product);
  const notes = [];
  const vmspNote = (endpoint, alias) => {
    if (!/\bvmsp\b|VCF Management Services Platform/i.test(String(endpoint || ''))) return;
    if (alias.kind === 'product-boundary')
      notes.push(`“${endpoint}” is presented as VCF Automation because the owning product is VCF Automation. The same VMSP label stays under VCF Management Services for every other product.`);
    else if (alias.componentId === 'management')
      notes.push(`“${endpoint}” stays under VCF Management Services. The Automation boundary rule only moves a “VCF Management Services Platform” label, and only when the owning product is VCF Automation.`);
  };
  vmspNote(row.source, source);
  vmspNote(row.destination, destination);
  return {source, destination, notes};
}
export function aliasReason(alias) {
  if (alias.kind === 'internet-domain') return `Explicit internet domain (${alias.matched}) stays external, even when the host label contains a product name.`;
  if (alias.kind === 'unmatched') return 'No alias rule matched, so the label stays under Infrastructure & External Services.';
  if (alias.kind === 'product-boundary') return `The label matched “${alias.matched}”, which would be VCF Management Services, but the owning product is VCF Automation.`;
  return `First matching alias rule, on “${alias.matched}”.`;
}
export function componentForEndpoint(endpoint) {
  return explainEndpoint(endpoint).componentId;
}
export function topologyPath(row) {
  const explained = explainPath(row);
  return [explained.source.componentId, explained.destination.componentId];
}
// One explanation per distinct published label pair on the current selection.
// Duplicate source records stay counted; they are not merged into one entry.
export function pathDerivations(rows) {
  const groups = new Map();
  for (const row of rows) {
    const explanation = explainPath(row);
    const key = [
      explanation.source.componentId, explanation.destination.componentId,
      row.source, row.destination,
      explanation.source.kind, explanation.source.matched, explanation.source.previousComponentId || '',
      explanation.destination.kind, explanation.destination.matched, explanation.destination.previousComponentId || '',
      explanation.notes.join('\n')
    ].join('\0');
    const group = groups.get(key) || {
      sourceId: explanation.source.componentId,
      destinationId: explanation.destination.componentId,
      sourceLabel: row.source || '',
      destinationLabel: row.destination || '',
      source: explanation.source,
      destination: explanation.destination,
      notes: explanation.notes,
      records: 0,
      products: new Set(),
      ports: new Set(),
      purposes: new Set(),
      services: new Set()
    };
    group.records++;
    if (row.product) group.products.add(row.product);
    group.ports.add(`${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`);
    if (row.purpose && row.purpose !== '-') group.purposes.add(row.purpose);
    if (row.serviceDescription && row.serviceDescription !== '-') group.services.add(row.serviceDescription);
    groups.set(key, group);
  }
  const list = values => [...values].sort((a, b) => a.localeCompare(b, 'en', {numeric:true}));
  return [...groups.values()].map(group => ({
    ...group,
    products: list(group.products),
    ports: list(group.ports),
    purposes: list(group.purposes),
    services: list(group.services),
    sameComponent: group.sourceId === group.destinationId
  })).sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId) || a.destinationId.localeCompare(b.destinationId) ||
    a.sourceLabel.localeCompare(b.sourceLabel, 'en') || a.destinationLabel.localeCompare(b.destinationLabel, 'en'));
}
export function filterByComponents(rows, selected) {
  if (!selected?.length) return rows;
  return rows.filter(row => {
    const [source, destination] = topologyPath(row);
    if (selected.length === 1) return source === selected[0] || destination === selected[0];
    return (source === selected[0] && destination === selected[1]) || (source === selected[1] && destination === selected[0]);
  });
}
export function topologyLinks(rows) {
  const links = new Map();
  for (const row of rows) {
    const [source, destination] = topologyPath(row);
    if (source === destination) continue;
    const pair = [source, destination].sort();
    const key = pair.join('|');
    const current = links.get(key) || {source:pair[0], destination:pair[1], count:0, ports:new Set(), directions:new Set()};
    current.count++;
    current.ports.add(`${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`);
    current.directions.add(`${source}>${destination}`);
    links.set(key, current);
  }
  return [...links.values()];
}
export function uniquePorts(rows) {
  return [...new Set(rows.map(row => `${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`))]
    .sort((a,b) => a.localeCompare(b, 'en', {numeric:true}));
}
// Aggregate filtered rows into firewall request rules: one row per component
// direction, port, and protocol, with unique purposes and classifications.
export function firewallRules(rows) {
  const groups = new Map();
  for (const row of rows) {
    const [sourceComponent, destinationComponent] = topologyPath(row);
    const source = environmentKeyForEndpoint(row.source, sourceComponent);
    const destination = environmentKeyForEndpoint(row.destination, destinationComponent);
    if (source === destination) continue;
    const key = `${source}|${destination}|${row.port || 'Not specified'}|${row.protocol || 'Not specified'}`;
    const rule = groups.get(key) || {source, destination, port: row.port || 'Not specified', protocol: row.protocol || 'Not specified', records: 0, purposes: new Set(), classifications: new Set()};
    rule.records++;
    if (row.purpose && row.purpose !== '-') rule.purposes.add(row.purpose);
    if (row.classification) rule.classifications.add(row.classification);
    groups.set(key, rule);
  }
  return [...groups.values()].sort((a,b) =>
    a.source.localeCompare(b.source, 'en') || a.destination.localeCompare(b.destination, 'en') ||
    a.port.localeCompare(b.port, 'en', {numeric:true}));
}
