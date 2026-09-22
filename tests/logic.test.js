import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterRows, csvCell, toCSV, matrixCounts, matrixAxes, sortRows, domainOwner, domainsInText, externalDomains, parseInstallerConfig, toFirewallCSV, toFirewallMarkdown, isBidirectional } from '../logic.js';
const data = JSON.parse(readFileSync(new URL('../data/vcf-9.1.json', import.meta.url)));

test('snapshot has explicit mapped release membership and accurate coverage', () => {
  assert.equal(data.vcfVersion, '9.1');
  assert.ok(data.rows.length > 0);
  assert.equal(new Set(data.rows.map(r=>r.id)).size, data.rows.length);
  for (const product of data.products) {
    const rows = data.rows.filter(r=>r.productId === product.id);
    assert.equal(rows.length, product.rowCount);
    for (const row of rows) {
      for (const key of ['source','destination','port','protocol']) assert.equal(typeof row[key], 'string');
      assert.ok(row.releases.length);
      assert.ok(row.releases.every(r=>product.releases.some(p=>p.id === r.id)));
    }
  }
});
test('filters combine with AND and search is case insensitive', () => {
  assert.equal(filterRows(data.rows, {}).length, data.rows.length);
  const row = data.rows[0];
  const matches = filterRows(data.rows, {product:row.productId, release:row.releases[0].id, source:row.source, destination:row.destination, protocol:row.protocol, classification:row.classification, search:row.purpose.toUpperCase()});
  assert.ok(matches.some(r=>r.id === row.id));
  assert.ok(matches.every(r=>r.productId===row.productId && r.source===row.source && r.destination===row.destination));
  assert.equal(filterRows(data.rows, {search:'no-such-endpoint-xyz'}).length, 0);
  assert.equal(filterRows(data.rows, {release:'nonexistent'}).length, 0);
});
test('matrix counts every entry once without synthesizing reverse connections', () => {
  const counts=matrixCounts(data.rows);
  assert.equal([...counts.values()].reduce((total,m)=>total+[...m.values()].reduce((a,b)=>a+b,0),0),data.rows.length);
  const simple=matrixCounts([{source:'A',destination:'B',classification:'Both'},{source:'A',destination:'B'}]);
  assert.equal(simple.get('A').get('B'),2); assert.equal(simple.has('B'),false);
});
test('matrix axes rank actual directional records and retain exact labels', () => {
  const rows=[{source:'Z source',destination:'X target'},{source:'Z source',destination:'X target'},{source:'A source',destination:'B target'}];
  assert.deepEqual(matrixAxes(rows), [['Z source','A source'],['X target','B target']]);
  assert.deepEqual(matrixAxes(rows,'alphabetical'), [['A source','Z source'],['B target','X target']]);
  assert.deepEqual(matrixAxes([]), [[],[]]);
});
test('external domains classify owners, honour wildcards, and ignore version noise', () => {
  assert.equal(domainOwner('portal.pulse.broadcom.com'),'broadcom');
  assert.equal(domainOwner('*.prod.nsxti.vmware.com'),'vmware');
  assert.equal(domainOwner('nsx.west.us.lastline.com'),'vmware');
  assert.equal(domainOwner('registry.k8s.io'),'other');
  const rows=[
    {id:'1',source:'SSP Node IP Pool',destination:'*.prod.nsxti.vmware.com',port:'443',protocol:'TCP',product:'vDefend',serviceDescription:'KB 327186 and version 9.1 must not leak domains.'},
    {id:'2',source:'SDDC Manager Management IP address',destination:'Broadcom public URLs',port:'443',protocol:'TCP',product:'SDDC Manager',serviceDescription:'Phone-home to scapi.telemetry.broadcom.com on 443.'},
    {id:'3',source:'SSP Node IP Pool',destination:'*.prod.nsxti.vmware.com',port:'443',protocol:'TCP',product:'vDefend',serviceDescription:'VTIS'}
  ];
  const list=externalDomains(rows);
  assert.deepEqual(list.map(d=>d.domain),['*.prod.nsxti.vmware.com','scapi.telemetry.broadcom.com']);
  assert.equal(list[0].owner,'vmware'); assert.equal(list[0].records,2); assert.equal(list[0].label,true); assert.equal(list[0].description,false);
  assert.equal(list[1].owner,'broadcom'); assert.equal(list[1].label,false); assert.equal(list[1].description,true);
  const snapshot=externalDomains(data.rows);
  for (const domain of ['access.broadcom.com','vcsa.vmware.com','registry.k8s.io']) assert.ok(snapshot.some(d=>d.domain===domain),domain);
  assert.ok(snapshot.every(d=>d.records>=1));
});
test('installer config import maps addressing and never touches credentials', () => {
  const fixture = JSON.stringify({
    hostSpecs: [{hostname:'esx01.vcf.lab', credentials:{password:'secret-password'}}, {hostname:'esx02.vcf.lab'}],
    networkSpecs: [
      {networkType:'MANAGEMENT', subnet:'172.30.0.0/24'},
      {networkType:'VMOTION', subnet:'172.30.40.0/24'},
      {networkType:'VSAN', subnet:'172.30.50.0/24'}],
    dnsSpec: {nameservers: ['192.168.30.29']},
    ntpServers: ['96.19.94.82'],
    vspClusterSpec: {platformFqdn:'vcf-msr01.vcf.lab', fleetFqdn:'vcf-flt01.vcf.lab', ipv4Pool:{ipRange:{startIpAddress:'172.30.0.33', endIpAddress:'172.30.0.46'}}},
    fleetLcmSpec: {hostname:'vcf-flt01.vcf.lab'},
    vcfAutomationSpec: {hostname:'auto01.vcf.lab', ipPool:['172.30.0.65','172.30.0.66']},
    nsxtSpec: {vipFqdn:'nsx01.vcf.lab', nsxtManagers:[{hostname:'nsx01a.vcf.lab'}], ipAddressPoolSpec:{subnets:[{cidr:'172.30.60.0/24'}]}},
    vcfOperationsSpec: {nodes:[{hostname:'vcf01.vcf.lab'}]},
    vcfOperationsCollectorSpec: {hostname:'vcf-proxy01.vcf.lab'},
    licenseServerSpec: {hostname:'vcf-lic01.vcf.lab'},
    vidbSpec: {hostname:'vcf-idb01.vcf.lab'},
    vcenterSpec: {vcenterHostname:'vc01.vcf.lab'},
    sddcManagerSpec: {hostname:'sddcm01.vcf.lab', localUserPassword:'secret-password-2'},
  });
  const mapping = parseInstallerConfig(fixture);
  assert.equal(mapping.esx, 'esx01.vcf.lab, esx02.vcf.lab, 172.30.40.0/24');
  assert.equal(mapping.vsan, '172.30.50.0/24');
  assert.ok(mapping.management.includes('vcf-msr01.vcf.lab'));
  assert.ok(mapping.management.includes('172.30.0.33-172.30.0.46'));
  assert.equal(mapping.automation, 'auto01.vcf.lab, 172.30.0.65, 172.30.0.66');
  assert.ok(mapping.nsx.includes('172.30.60.0/24'));
  assert.equal(mapping.licensing, 'vcf-lic01.vcf.lab');
  assert.equal(mapping.identity, 'vcf-idb01.vcf.lab');
  assert.equal(mapping.vcenter, 'vc01.vcf.lab');
  assert.equal(mapping['external-dns'], '192.168.30.29');
  assert.equal(mapping['external-ntp'], '96.19.94.82');
  assert.ok(!JSON.stringify(mapping).includes('secret-password'), 'credentials must not leak');
});
test('firewall templates fill mapped addresses and keep placeholders for gaps', () => {
  const rules = [
    {source:'vcenter', destination:'esx', port:'443', protocol:'TCP', records:2, purposes:new Set(['vCenter management']), classifications:new Set(['Both'])},
    {source:'nsx', destination:'esx', port:'902', protocol:'TCP', records:1, purposes:new Set(['host management']), classifications:new Set(['Outbound'])},
  ];
  const names = {vcenter:'vCenter', esx:'ESX Hosts', nsx:'NSX'};
  const csv = toFirewallCSV(rules, {vcenter:'vc01.lab'}, names);
  assert.ok(csv.startsWith('\uFEFF"Source address"'));
  assert.ok(csv.includes('"vc01.lab"'));
  assert.ok(csv.includes('<ESX Hosts IPs / FQDNs>'));
  assert.ok(csv.includes('"yes"') && csv.includes('"no"'));
  const md = toFirewallMarkdown(rules, {}, names, {snapshot:'test'});
  assert.ok(md.startsWith('# VCF 9.1 firewall request'));
  assert.ok(md.includes('| vc01.lab |') === false && md.includes('<vCenter IPs / FQDNs>'));
  assert.equal(isBidirectional(['Both','Outbound']), true);
  assert.equal(isBidirectional(['Outbound']), false);
});
test('presentation sorting is numeric, stable, and never mutates source rows', () => {
  const rows = [{port:'443', id:1}, {port:'80', id:2}, {port:'443', id:3}, {port:'8080', id:4}];
  assert.deepEqual(sortRows(rows, 'port').map(r=>r.id), [2,1,3,4]);
  assert.deepEqual(sortRows(rows, 'port', 'desc').map(r=>r.id), [4,1,3,2]);
  assert.deepEqual(sortRows(rows, 'unknown'), rows);
  assert.deepEqual(rows.map(r=>r.id), [1,2,3,4]);
});
test('CSV quotes values, retains multiline descriptions, and mitigates formulas', () => {
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell(' @SUM(1)'),'"\' @SUM(1)"');
  const csv=toCSV([data.rows[0]]);
  assert.ok(csv.startsWith('\uFEFF"product"'));
  assert.ok(csv.includes(data.rows[0].id));
});
