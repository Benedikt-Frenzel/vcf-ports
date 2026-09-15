import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPONENTS, componentForEndpoint, filterByComponents, topologyLinks, topologyPath, uniquePorts } from '../topology.js';
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
    'License Hub Node IP Pool':'licensing',
    'License Server Management IP address':'licensing',
    'VCF Installer Management IP address':'management',
    'DNS Resolvers':'infrastructure'
  };
  for (const [endpoint, expected] of Object.entries(cases)) assert.equal(componentForEndpoint(endpoint), expected, endpoint);
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
test('links aggregate unordered pairs while preserving unique port labels', () => {
  const rows=[
    {source:'ESX Management IP addresses',destination:'vCenter Server Management IP address',port:'443',protocol:'TCP'},
    {source:'vCenter Server Management IP address',destination:'ESX Management IP addresses',port:'902',protocol:'TCP'}
  ];
  const links=topologyLinks(rows);
  assert.equal(links.length,1); assert.equal(links[0].count,2); assert.equal(links[0].ports.size,2); assert.equal(links[0].directions.size,2);
  assert.deepEqual(uniquePorts(rows),['443 / TCP','902 / TCP']);
});
