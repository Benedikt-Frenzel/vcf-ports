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
export function matrixCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!counts.has(row.source)) counts.set(row.source, new Map());
    const destinations = counts.get(row.source);
    destinations.set(row.destination, (destinations.get(row.destination) || 0) + 1);
  }
  return counts;
}
