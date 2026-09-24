import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPONENTS, ENVIRONMENT_SERVICES, aliasReason, componentForEndpoint, directedPairs, directedPairsForSelection, environmentKeyForEndpoint, explainPath, filterByComponents, firewallRules, pathDerivations, topologyLinks, topologyPath, uniquePorts } from '../topology.js';
const data = JSON.parse(readFileSync(new URL('../data/vcf-9.1.json', import.meta.url)));

test('known latency-diagram endpoint labels map to logical components', () => {
  const cases = {
    'VCF Operations for Networks (internal/loopback)':'networks',
    'VCF Operations for Logs Management IP address':'logs',
    'VCF Operations Cluster Nodes':'operations',
    'VCF Management Services Platform IP addresses':'management',
    'SDDC Manager Management IP address':'sddc',
    'vCenter Server Management IP address':'vcenter',
    'ESX Management IP addresses':'esx',
    'ESX vSAN IP addresses':'vsan',
    'NSX Edge nodes':'nsx',
    'Supervisor Control Plane Management Network IP address':'supervisor',
    'HCX Manager':'hcx',
    'DSM Database Cluster Node':'dsm',
    'Avi Controller':'avi',
    'SSP Node IP Pool':'vdefend',
    'MPS VPN Gateway VM':'private-ai',
    'Cyber Recovery Connector':'recovery',
    'Management Workstations':'clients',
    'nsx.lastline.com':'infrastructure',
    'https://vcsa.vmware.com':'infrastructure',
    'tcp.anonvpn.broadcom.com':'infrastructure',
    'Software Depot':'depot',
    'Offline Depot ':'infrastructure',
    'License Hub Node IP Pool':'vdefend',
    'License Server Management IP address':'licensing',
    'VCF Installer Management IP address':'installer',
    'VCF Installer (internal/loopback)':'installer',
    'DNS Resolvers':'infrastructure',
    'Microsoft Active Directory Domain Controllers':'infrastructure',
    'Mgmt clients':'clients',
    'Source IX/NE UDP Port Range 4500-4628':'hcx',
    'User MCP Servers (external)':'infrastructure',
    'Backup Servers':'infrastructure',
    'VCF Download Tool':'clients',
    'Fleet components':'depot',
    'All VCF services runtime IP pools that host a software depot':'depot'
  };
  for (const [endpoint, expected] of Object.entries(cases)) assert.equal(componentForEndpoint(endpoint), expected, endpoint);
});
test('every selected path can explain the alias that placed each published label', () => {
  for (const row of data.rows) {
    const explained = explainPath(row);
    assert.deepEqual(topologyPath(row), [explained.source.componentId, explained.destination.componentId]);
    for (const side of [explained.source, explained.destination]) {
      assert.ok(['label','internet-domain','unmatched','product-boundary','combined-label'].includes(side.kind), side.kind);
      assert.ok(aliasReason(side));
      if (['label','product-boundary','combined-label'].includes(side.kind)) assert.match(row.source + ' ' + row.destination, new RegExp(side.matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  }
  const nsx = pathDerivations(data.rows.filter(row => row.source === 'NSX Edge / Host' && row.destination === 'VMSP Cluster' && row.port === '443'));
  assert.equal(nsx.length, 1);
  assert.equal(nsx[0].records, 2);
  assert.equal(nsx[0].sourceId, 'nsx');
  assert.equal(nsx[0].destinationId, 'management');
  assert.equal(nsx[0].source.matched, 'NSX');
  assert.equal(nsx[0].destination.matched, 'VMSP');
  assert.match(nsx[0].notes[0], /stays under VCF Management Services/);
  assert.deepEqual(nsx[0].ports, ['443 / TCP']);
  const automation = data.rows.find(row => row.product === 'VCF Automation' && row.source.startsWith('VCF Management Services Platform') && row.destination.startsWith('vCenter'));
  const automationPath = explainPath(automation);
  assert.equal(automationPath.source.kind, 'product-boundary');
  assert.equal(automationPath.source.componentId, 'automation');
  assert.match(automationPath.notes[0], /owning product is VCF Automation/);
  const external = explainPath({source:'vCenter Server', destination:'nsx.lastline.com', product:'vDefend'});
  assert.equal(external.destination.kind, 'internet-domain');
  assert.equal(external.destination.componentId, 'infrastructure');
  const unmatched = explainPath({source:'Offline Depot', destination:'DNS Resolvers'});
  assert.equal(unmatched.source.kind, 'unmatched');
  assert.equal(unmatched.source.componentId, 'infrastructure');
});
test('VCF Automation presents its included VMSP to vCenter records at the Automation service boundary', () => {
  const automationRow = data.rows.find(row => row.product === 'VCF Automation' && row.source.startsWith('VCF Management Services Platform') && row.destination.startsWith('vCenter'));
  const managementRow = data.rows.find(row => row.product === 'VCF Management Services' && row.source.startsWith('VCF Management Services Platform') && row.destination.startsWith('vCenter'));
  assert.ok(automationRow); assert.ok(managementRow);
  assert.deepEqual(topologyPath(automationRow), ['automation','vcenter']);
  assert.deepEqual(topologyPath(managementRow), ['management','vcenter']);
  assert.equal(automationRow.port, '443');
});
test('every source record maps to known topology nodes', () => {
  const ids = new Set(COMPONENTS.map(c=>c.id));
  for (const row of data.rows) {
    const path=topologyPath(row);
    assert.ok(ids.has(path[0]), row.source);
    assert.ok(ids.has(path[1]), row.destination);
  }
});
test('one component includes touching paths; two require a direct path either way', () => {
  const rows=[
    {source:'ESX Management IP addresses',destination:'vCenter Server Management IP address',port:'443',protocol:'TCP'},
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'902',protocol:'TCP'},
    {source:'DNS Resolvers',destination:'ESX Management IP addresses',port:'53',protocol:'UDP'}
  ];
  assert.equal(filterByComponents(rows,['esx']).length,3);
  assert.equal(filterByComponents(rows,['esx','vcenter']).length,2);
  assert.equal(filterByComponents(rows,['vcenter','infrastructure']).length,0);
});
test('firewall rules aggregate per direction, port, and protocol', () => {
  const rows = [
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'443',protocol:'TCP',purpose:'management',classification:'Both',product:'vCenter'},
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'443',protocol:'TCP',purpose:'management',classification:'Both',product:'ESX'},
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'902',protocol:'TCP',purpose:'host agent',classification:'Outbound',product:'vCenter'},
    {source:'vCenter Server Management IP address',destination:'vCenter Server Management IP address',port:'443',protocol:'TCP',purpose:'internal',classification:'Cluster Internal',product:'vCenter'},
  ];
  const rules = firewallRules(rows);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].port, '443');
  assert.equal(rules[0].records, 2);
  assert.deepEqual([...rules[0].purposes], ['management']);
  const snapshotRules = firewallRules(data.rows);
  const total = snapshotRules.reduce((sum, rule) => sum + rule.records, 0);
  const drawn = data.rows.reduce((count, row) => count + directedPairs(row).filter(([s,d]) => environmentKeyForEndpoint(row.source,s) !== environmentKeyForEndpoint(row.destination,d)).length, 0);
  assert.equal(total, drawn);
  const environmentIds=new Set([...COMPONENTS,...ENVIRONMENT_SERVICES].map(item => item.id));
  assert.ok(snapshotRules.every(rule => environmentIds.has(rule.source) && environmentIds.has(rule.destination)));
});
test('firewall rules keep external infrastructure services separate', () => {
  const rules=firewallRules([
    {source:'vCenter Server Management IP address',destination:'DNS Resolvers',port:'53',protocol:'UDP',purpose:'DNS',classification:'Outbound'},
    {source:'vCenter Server Management IP address',destination:'NTP Server',port:'123',protocol:'UDP',purpose:'NTP',classification:'Outbound'},
    {source:'VCF Identity Broker',destination:'Microsoft Active Directory Domain Controllers',port:'636',protocol:'TCP',purpose:'LDAPS',classification:'Outbound'}
  ]);
  assert.deepEqual(rules.map(rule => rule.destination),['external-directory','external-dns','external-ntp']);
  assert.deepEqual(rules.map(rule => rule.port),['636','53','123']);
});
test('links aggregate unordered pairs while preserving unique port labels', () => {
  const rows=[
    {source:'ESX Management IP addresses',destination:'vCenter Server Management IP address',port:'443',protocol:'TCP'},
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'902',protocol:'TCP'}
  ];
  const links=topologyLinks(rows);
  assert.equal(links.length,1); assert.equal(links[0].count,2); assert.equal(links[0].ports.size,2); assert.equal(links[0].directions.size,2);
  assert.deepEqual(uniquePorts(rows),['443 / TCP','902 / TCP']);
});
test('VCF Installer has its own source-backed deployment paths', () => {
  const installerRows=data.rows.filter(row => /VCF Installer/i.test(row.source) || /VCF Installer/i.test(row.destination));
  assert.equal(installerRows.length,42);
  const links=topologyLinks(installerRows);
  const destinations=new Set(links.flatMap(link => [link.source,link.destination]).filter(id => id !== 'installer'));
  for (const id of ['automation','operations','logs','networks','management','sddc','vcenter','nsx','esx','vsan','supervisor','depot','clients','infrastructure'])
    assert.ok(destinations.has(id), `missing Installer path to ${id}`);
  assert.equal(componentForEndpoint('Microsoft Active Directory Domain Controllers'), 'infrastructure');
  assert.ok(!destinations.has('identity'), 'Active Directory must not be drawn as the Identity Broker');
  assert.ok(links.every(link => link.source === 'installer' || link.destination === 'installer'));
});
test('combined VCSA / ESXi endpoints and vDefend service pools keep their documented components', () => {
  const combined = {source:'VMSP Cluster', destination:'VCSA / ESXi', port:'443', protocol:'TCP', product:'VCF Operations'};
  assert.deepEqual(directedPairs(combined), [['management','vcenter'],['management','esx']]);
  assert.deepEqual(directedPairsForSelection(combined, ['management','esx']), [['management','esx']]);
  assert.equal(filterByComponents([combined], ['esx']).length, 1);
  assert.deepEqual(pathDerivations([combined], ['management','esx']).map(item => [item.sourceId,item.destinationId]), [['management','esx']]);
  assert.deepEqual(firewallRules([combined]).map(rule => rule.destination), ['esx','vcenter']);
  assert.deepEqual(firewallRules([combined], ['management','esx']).map(rule => rule.destination), ['esx']);
  const pool = {source:'Mgmt clients', destination:'Service IP Pool', port:'443', protocol:'TCP', product:'VMware vDefend'};
  assert.deepEqual(topologyPath(pool), ['clients','vdefend']);
  const licenseServer = {source:'vCenter Server Management IP address', destination:'License Server Management IP address', product:'vCenter'};
  const licenseHub = {source:'SSP Installer', destination:'License Hub Node IP Pool', product:'VMware vDefend'};
  assert.equal(topologyPath(licenseServer)[1], 'licensing');
  assert.equal(topologyPath(licenseHub)[1], 'vdefend');
});
