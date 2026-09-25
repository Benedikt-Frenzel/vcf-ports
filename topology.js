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
  {id:'external-dns', name:'DNS Servers', pattern:/\bDNS (?:Resolvers|servers?)\b/i},
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
  {id:'clients', pattern:/^VCF Download Tool$/i},
  {id:'depot', pattern:/^All VCF services runtime IP pools/i},
  {id:'depot', pattern:/^Fleet components/i},
  {id:'supervisor', pattern:/^(Prometheus|Alertmanager|Grafana|Kyverno)$/i},
  {id:'supervisor', pattern:/^vSphere Kubernetes Service/i},
  {id:'networks', pattern:/operations for networks|\bvrni\b|network insight/i},
  {id:'logs', pattern:/operations for logs|log insight|log assist|log source|clickhouse|cplf/i},
  {id:'hcx', pattern:/\bhcx\b|interconnect \(|network extension|sentinel (gateway|data|agent)|ix\/ne/i},
  {id:'operations', pattern:/vcf operations|\bvrops\b|cloud proxy|operations collector|collector$/i},
  {id:'automation', pattern:/vcf automation|salt (raas|master)/i},
  {id:'identity', pattern:/identity broker/i},
  {id:'private-ai', pattern:/\bmps\b|aiplatform|intelligent.assist|ai\.azure|nvidia/i},
  {id:'dsm', pattern:/\bdsm\b|database cluster|postgres/i},
  {id:'recovery', pattern:/protection and recovery|vsphere replication|cyber recovery|live recovery/i},
  {id:'avi', pattern:/\bavi\b|service engine|load balancer data plane|pool application/i},
  {id:'vdefend', pattern:/vdefend|lastline|anonvpn|\bssp\b|license hub|sandbox (vcenter|esx)/i},
  {id:'depot', pattern:/software depot/i},
  {id:'licensing', pattern:/license server/i},
  {id:'installer', pattern:/\bvcf installer\b/i},
  {id:'management', pattern:/vcf management services|\bvmsp\b|\blcm\b/i},
  {id:'sddc', pattern:/sddc manager/i},
  {id:'vsan', pattern:/\bvsan\b|vasa\/vvol|rdma storage/i},
  {id:'nsx', pattern:/\bnsx\b|host transport node|geneve|external routing peers|ipsec peers/i},
  {id:'vcenter', pattern:/vcenter|\bvcsa\b|enhanced linked mode|\bvcha\b|^vc$/i},
  {id:'supervisor', pattern:/supervisor|kubernetes|\bvks\b|\btkgi\b|antrea|service ip pool/i},
  {id:'esx', pattern:/\besx\b|\besxi\b|vmotion|nfs ip addresses|iscsi ip addresses/i},
  {id:'clients', pattern:/workstation|management client|mgmt clients|administration system|web browser|ui client|api client|user \/ client|site recovery ui|application client/i}
];
const VMSP_PLATFORM = /VCF Management Services Platform/i;
const COMBINED_VCENTER_ESX = /VCSA\s*\/\s*ESXi/i;
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
function applyProductBoundary(alias, endpoint, row = {}) {
  const text = String(endpoint || '');
  if (row.product === 'VMware vDefend' && alias.componentId === 'supervisor' && /service ip pool/i.test(text))
    return {...alias, componentId:'vdefend', kind:'product-boundary', previousComponentId:'supervisor', boundary:'vdefend-service-pool'};
  if (row.product === 'VCF Automation' && alias.componentId === 'management' && VMSP_PLATFORM.test(text))
    return {...alias, componentId:'automation', kind:'product-boundary', previousComponentId:'management', boundary:'automation-vmsp'};
  return alias;
}
function endpointAliases(endpoint, row = {}) {
  const text = String(endpoint || '');
  const combined = text.match(COMBINED_VCENTER_ESX);
  if (combined) return ['vcenter','esx'].map(componentId => ({componentId, kind:'combined-label', matched:combined[0]}));
  return [applyProductBoundary(explainEndpoint(text), text, row)];
}
export function componentForEndpoint(endpoint) {
  return explainEndpoint(endpoint).componentId;
}
export function endpointComponents(endpoint, row = {}) {
  return endpointAliases(endpoint, row).map(alias => alias.componentId);
}
function explanationNotes(row, source, destination) {
  const notes = [];
  const vmspNote = (endpoint, alias) => {
    if (!/\bvmsp\b|VCF Management Services Platform/i.test(String(endpoint || ''))) return;
    if (alias.boundary === 'automation-vmsp')
      notes.push(`“${endpoint}” is presented as VCF Automation because the owning product is VCF Automation. The same VMSP label stays under VCF Management Services for every other product.`);
    else if (alias.componentId === 'management')
      notes.push(`“${endpoint}” stays under VCF Management Services. The Automation boundary rule only moves a “VCF Management Services Platform” label, and only when the owning product is VCF Automation.`);
  };
  vmspNote(row.source, source);
  vmspNote(row.destination, destination);
  return notes;
}
export function explainPairs(row) {
  const pairs = [];
  for (const source of endpointAliases(row.source, row)) {
    for (const destination of endpointAliases(row.destination, row))
      pairs.push({source, destination, notes:explanationNotes(row, source, destination)});
  }
  return pairs;
}
export function explainPath(row) {
  return explainPairs(row)[0];
}
export function aliasReason(alias) {
  if (alias.kind === 'internet-domain') return `Explicit internet domain (${alias.matched}) stays external, even when the host label contains a product name.`;
  if (alias.kind === 'unmatched') return 'No alias rule matched, so the label stays under Infrastructure & External Services.';
  if (alias.kind === 'combined-label') return `The combined label “${alias.matched}” explicitly represents both vCenter and ESX.`;
  if (alias.boundary === 'automation-vmsp') return `The label matched “${alias.matched}”, which would be VCF Management Services, but the owning product is VCF Automation.`;
  if (alias.boundary === 'vdefend-service-pool') return `The label matched “${alias.matched}”, but a VMware vDefend service IP pool belongs to vDefend.`;
  return `First matching alias rule, on “${alias.matched}”.`;
}
export function directedPairs(row) {
  return explainPairs(row).map(({source,destination}) => [source.componentId,destination.componentId]);
}
function pairMatchesSelection(pair, selected) {
  if (!selected?.length) return true;
  if (selected.length === 1) return pair.includes(selected[0]);
  return (pair[0] === selected[0] && pair[1] === selected[1]) || (pair[0] === selected[1] && pair[1] === selected[0]);
}
export function directedPairsForSelection(row, selected) {
  return directedPairs(row).filter(pair => pairMatchesSelection(pair, selected));
}
export function topologyPath(row) {
  return directedPairs(row)[0];
}
// One explanation per distinct published label pair and derived component pair.
// Duplicate source records stay counted; they are not merged into one entry.
export function pathDerivations(rows, selected = []) {
  const groups = new Map();
  for (const row of rows) {
    for (const explanation of explainPairs(row)) {
      const pair = [explanation.source.componentId, explanation.destination.componentId];
      if (!pairMatchesSelection(pair, selected)) continue;
      const key = [
        ...pair, row.source, row.destination,
        explanation.source.kind, explanation.source.matched, explanation.source.previousComponentId || '', explanation.source.boundary || '',
        explanation.destination.kind, explanation.destination.matched, explanation.destination.previousComponentId || '', explanation.destination.boundary || '',
        explanation.notes.join('\n')
      ].join('\0');
      const group = groups.get(key) || {
        sourceId:pair[0], destinationId:pair[1], sourceLabel:row.source || '', destinationLabel:row.destination || '',
        source:explanation.source, destination:explanation.destination, notes:explanation.notes,
        records:0, products:new Set(), ports:new Set(), purposes:new Set(), services:new Set(), origins:new Set(), citations:new Set()
      };
      group.records++;
      if (row.product) group.products.add(row.product);
      group.ports.add(`${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`);
      if (row.purpose && row.purpose !== '-') group.purposes.add(row.purpose);
      if (row.serviceDescription && row.serviceDescription !== '-') group.services.add(row.serviceDescription);
      group.origins.add(row.origin || 'ports');
      if (row.citationUrl) group.citations.add(row.citationUrl);
      groups.set(key, group);
    }
  }
  const list = values => [...values].sort((a, b) => a.localeCompare(b, 'en', {numeric:true}));
  return [...groups.values()].map(group => ({
    ...group,
    products:list(group.products), ports:list(group.ports), purposes:list(group.purposes), services:list(group.services),
    origins:list(group.origins), citations:list(group.citations), sameComponent:group.sourceId === group.destinationId
  })).sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId) || a.destinationId.localeCompare(b.destinationId) ||
    a.sourceLabel.localeCompare(b.sourceLabel, 'en') || a.destinationLabel.localeCompare(b.destinationLabel, 'en'));
}
export function filterByComponents(rows, selected) {
  if (!selected?.length) return rows;
  return rows.filter(row => directedPairsForSelection(row, selected).length);
}
export function topologyLinks(rows) {
  const links = new Map();
  for (const row of rows) {
    for (const [source, destination] of directedPairs(row)) {
      if (source === destination) continue;
      const pair = [source, destination].sort();
      const key = pair.join('|');
      const current = links.get(key) || {source:pair[0], destination:pair[1], count:0, ports:new Set(), directions:new Set(), origins:new Set()};
      current.count++;
      current.ports.add(`${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`);
      current.directions.add(`${source}>${destination}`);
      current.origins.add(row.origin || 'ports');
      links.set(key, current);
    }
  }
  return [...links.values()];
}
export function uniquePorts(rows) {
  return [...new Set(rows.map(row => `${row.port || 'Not specified'} / ${row.protocol || 'Not specified'}`))]
    .sort((a,b) => a.localeCompare(b, 'en', {numeric:true}));
}
// Aggregate filtered rows into firewall request rules: one row per component
// direction, port, and protocol, with unique purposes and classifications.
export function firewallRules(rows, selected = []) {
  const groups = new Map();
  for (const row of rows) {
    for (const [sourceComponent, destinationComponent] of directedPairsForSelection(row, selected)) {
      const source = environmentKeyForEndpoint(row.source, sourceComponent);
      const destination = environmentKeyForEndpoint(row.destination, destinationComponent);
      if (source === destination) continue;
      const key = `${source}|${destination}|${row.port || 'Not specified'}|${row.protocol || 'Not specified'}`;
      const rule = groups.get(key) || {
        source, destination, port:row.port || 'Not specified', protocol:row.protocol || 'Not specified', records:0,
        purposes:new Set(), classifications:new Set(), origins:new Set(), citations:new Set()
      };
      rule.records++;
      if (row.purpose && row.purpose !== '-') rule.purposes.add(row.purpose);
      if (row.classification) rule.classifications.add(row.classification);
      rule.origins.add(row.origin || 'ports');
      if (row.citationUrl) rule.citations.add(row.citationUrl);
      groups.set(key, rule);
    }
  }
  return [...groups.values()].sort((a,b) =>
    a.source.localeCompare(b.source, 'en') || a.destination.localeCompare(b.destination, 'en') ||
    a.port.localeCompare(b.port, 'en', {numeric:true}));
}
