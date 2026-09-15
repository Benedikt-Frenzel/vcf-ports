import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterRows, csvCell, toCSV, matrixCounts, matrixAxes, sortRows, domainOwner, domainsInText, externalDomains } from '../logic.js';
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
