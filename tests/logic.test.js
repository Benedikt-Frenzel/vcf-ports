import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterRows, csvCell, toCSV, matrixCounts } from '../logic.js';
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
test('CSV quotes values, retains multiline descriptions, and mitigates formulas', () => {
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell(' @SUM(1)'),'"\' @SUM(1)"');
  const csv=toCSV([data.rows[0]]);
  assert.ok(csv.startsWith('\uFEFF"product"'));
  assert.ok(csv.includes(data.rows[0].id));
});
