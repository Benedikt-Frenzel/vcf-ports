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
export function matrixCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!counts.has(row.source)) counts.set(row.source, new Map());
    const destinations = counts.get(row.source);
    destinations.set(row.destination, (destinations.get(row.destination) || 0) + 1);
  }
  return counts;
}
