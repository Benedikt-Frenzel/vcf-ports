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
const rules = [
  ['networks', /operations for networks|\bvrni\b|network insight/i],
  ['logs', /operations for logs|log insight|log assist|log source|clickhouse|cplf/i],
  ['hcx', /\bhcx\b|interconnect \(|network extension|sentinel (gateway|data|agent)/i],
  ['operations', /vcf operations|\bvrops\b|cloud proxy|operations collector|collector$/i],
  ['automation', /vcf automation|salt (raas|master)/i],
  ['identity', /identity broker|identity provider|active directory|\bldap\b/i],
  ['private-ai', /\bmps\b|aiplatform|intelligent.assist|ai\.azure|mcp server|otel collector|nvidia/i],
  ['dsm', /\bdsm\b|database cluster|postgres/i],
  ['recovery', /protection and recovery|vsphere replication|cyber recovery|live recovery/i],
  ['avi', /\bavi\b|service engine|load balancer data plane|pool application/i],
  ['vdefend', /vdefend|lastline|anonvpn|\bssp\b|sandbox (vcenter|esx)/i],
  ['depot', /software depot/i],
  ['licensing', /license hub|license server/i],
  ['installer', /\bvcf installer\b/i],
  ['management', /vcf management services|\bvmsp\b|\blcm\b/i],
  ['sddc', /sddc manager/i],
  ['vsan', /\bvsan\b|vasa\/vvol|rdma storage/i],
  ['nsx', /\bnsx\b|host transport node|geneve|external routing peers|ipsec peers/i],
  ['vcenter', /vcenter|\bvcsa\b|enhanced linked mode|\bvcha\b|^vc$/i],
  ['supervisor', /supervisor|kubernetes|\bvks\b|\btkgi\b|antrea|service ip pool/i],
  ['esx', /\besx\b|\besxi\b|vmotion|nfs ip addresses|iscsi ip addresses/i],
  ['clients', /workstation|management client|administration system|web browser|ui client|api client|user \/ client|site recovery ui|application client|backup server/i]
];
export function componentForEndpoint(endpoint) {
  const text = String(endpoint || '');
  // Explicit internet domains (broadcom.com, vmware.com, lastline.com, …) are
  // always external destinations, even when the host label contains product
  // prefixes like "nsx." or "vcsa.".
  if (domainsInText(text).size) return 'infrastructure';
  for (const [id, pattern] of rules) if (pattern.test(text)) return id;
  return 'infrastructure';
}
export function topologyPath(row) {
  let source = componentForEndpoint(row.source);
  let destination = componentForEndpoint(row.destination);
  // The VCF Automation release contains VMSP records as part of its service
  // boundary. Keep the same endpoint under Management Services for that
  // product, but present it as Automation when the owning product is Automation.
  if (row.product === 'VCF Automation') {
    if (source === 'management' && /VCF Management Services Platform/i.test(row.source)) source = 'automation';
    if (destination === 'management' && /VCF Management Services Platform/i.test(row.destination)) destination = 'automation';
  }
  return [source, destination];
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
    const [source, destination] = topologyPath(row);
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
