import { filterRows, toCSV, matrixCounts, matrixAxes, sortRows } from './logic.js';
import { COMPONENTS, filterByComponents, topologyLinks, topologyPath, uniquePorts } from './topology.js';
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique = values => [...new Set(values)].sort((a,b) => a.localeCompare(b, 'en', {numeric:true}));
const fields = ['search','product','release','protocol','classification','source','destination'];
let data, filtered = [], page = 0, sourcePage = 0, destPage = 0, view = 'diagram', selectedComponents = [];
const componentById = new Map(COMPONENTS.map(component => [component.id, component]));
const sourceSize = 15, destSize = 8;
function options(id, values, title) {
  $(id).replaceChildren(new Option(title, ''), ...values.map(v => new Option(v.name ?? v, v.id ?? v)));
}
function releaseOptions() {
  const products = $('product').value ? data.products.filter(p => p.id === $('product').value) : data.products;
  options('release', products.flatMap(p => p.releases.map(r => ({id:r.id,name:`${p.name} · ${r.name}`}))), 'All mapped releases');
}
function filters() { return Object.fromEntries(fields.map(k => [k, $(k).value])); }
function saveState() {
  const params = new URLSearchParams(Object.entries(filters()).filter(([,v]) => v));
  if (view !== 'diagram') params.set('view', view);
  if (selectedComponents.length) params.set('components', selectedComponents.join(','));
  history.replaceState(null, '', `${location.pathname}${params.size ? '?' + params : ''}${location.hash}`);
}
function render() {
  const baseRows = filterRows(data.rows, filters());
  filtered = filterByComponents(baseRows, selectedComponents);
  const pathLabel = selectedComponents.length ? ` · component path filter: ${selectedComponents.map(id => componentById.get(id).name).join(' ↔ ')}` : '';
  $('results').textContent = `${filtered.length.toLocaleString('en')} of ${data.rows.length.toLocaleString('en')} entries${pathLabel}`;
  $('empty').hidden = filtered.length > 0 || view === 'diagram';
  $('export').disabled = filtered.length === 0;
  $('list-view').hidden = view !== 'list' || !filtered.length;
  $('matrix-view').hidden = view !== 'matrix' || !filtered.length;
  $('diagram-view').hidden = view !== 'diagram';
  for (const v of ['diagram','list','matrix']) {
    $(`${v}-tab`).classList.toggle('active', view === v);
    $(`${v}-tab`).setAttribute('aria-selected', String(view === v));
  }
  if (view === 'list') renderList();
  else if (view === 'matrix') renderMatrix();
  else renderTopology(baseRows);
  saveState();
}
function renderList() {
  const pageSize = Number($('list-size').value);
  const sorted = sortRows(filtered, $('list-sort').value, $('list-order').value);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages - 1);
  $('rows').innerHTML = sorted.slice(page*pageSize,(page+1)*pageSize).map(r => `<tr>
    <td><strong>${escape(r.product)}</strong><span class="sub">${r.releases.map(v => escape(v.name)).join(' · ')}</span></td>
    <td class="endpoint-name">${escape(r.source)}</td>
    <td class="endpoint-name">${escape(r.destination)}</td>
    <td><span class="port">${escape(r.port || 'Not specified')}</span><span class="protocol-badge">${escape(r.protocol || 'Not specified')}</span></td>
    <td><span class="purpose">${escape(r.purpose || 'Not specified')}</span><details class="record-details"><summary>Service &amp; source details</summary><div class="description">${escape(r.serviceDescription || 'No service description published.')}</div><dl><dt>Record ID</dt><dd>${escape(r.id)}</dd><dt>Published</dt><dd>${escape(r.publishDate || 'Not specified')}</dd></dl><a href="https://ports.broadcom.com/" target="_blank" rel="noopener">Verify at official source ↗</a></details></td>
    <td><span class="classification-badge">${escape(r.classification || 'Not specified')}</span></td></tr>`).join('');
  $('list-count').textContent = `${filtered.length.toLocaleString('en')} entries`;
  $('list-range').textContent = `Showing ${page*pageSize+1}–${Math.min((page+1)*pageSize,filtered.length)} of ${filtered.length.toLocaleString('en')}`;
  $('page').textContent = `Page ${page+1} of ${pages}`;
  $('prev').disabled = page === 0; $('next').disabled = page === pages-1;
}
function renderMatrix() {
  const [sources, destinations] = matrixAxes(filtered, $('matrix-order').value);
  sourcePage = Math.min(sourcePage, Math.max(0,Math.ceil(sources.length/sourceSize)-1));
  destPage = Math.min(destPage, Math.max(0,Math.ceil(destinations.length/destSize)-1));
  const ss = sources.slice(sourcePage*sourceSize,(sourcePage+1)*sourceSize);
  const ds = destinations.slice(destPage*destSize,(destPage+1)*destSize);
  const counts = matrixCounts(filtered);
  $('matrix-count').textContent = `${sources.length} sources · ${destinations.length} destinations`;
  $('matrix').innerHTML = `<table class="matrix-table"><caption class="visually-hidden">Published connections: source → destination</caption><thead><tr><th scope="col">Source ↓ / Destination →</th>${ds.map(d=>`<th scope="col">${escape(d)}</th>`).join('')}</tr></thead><tbody>${ss.map((s,si)=>`<tr><th scope="row">${escape(s)}</th>${ds.map((d,di)=>{const count=counts.get(s)?.get(d)||0;return `<td>${count ? `<button class="matrix-cell ${count>=10?'density-many':count>1?'density-few':'density-one'}" data-si="${si}" data-di="${di}" aria-label="${escape(`${s} to ${d}: ${count} entries. View connections`)}">${count}</button>`:'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  $('matrix').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    $('source').value = ss[Number(button.dataset.si)]; $('destination').value = ds[Number(button.dataset.di)];
    view = 'list'; page = 0; render(); $('list-tab').focus();
  }));
  for (const [prefix,index,size,items] of [['source',sourcePage,sourceSize,sources],['dest',destPage,destSize,destinations]]) {
    $(`${prefix}-page`).textContent = `${items.length ? index*size+1 : 0}–${Math.min((index+1)*size,items.length)} / ${items.length}`;
    $(`${prefix}-prev`).disabled = index === 0;
    $(`${prefix}-next`).disabled = (index+1)*size >= items.length;
  }
}
function splitLabel(label) {
  if (label.length <= 22) return [label];
  const words = label.split(' '), lines = ['', ''];
  for (const word of words) {
    const target = lines[0].length < Math.ceil(label.length / 2) ? 0 : 1;
    lines[target] += `${lines[target] ? ' ' : ''}${word}`;
  }
  return lines;
}
function renderTopology(baseRows) {
  const links = topologyLinks(baseRows);
  const pairKey = (a,b) => [a,b].sort().join('|');
  const backbone = new Set([
    ['automation','management'],['automation','vcenter'],['automation','nsx'],
    ['operations','management'],['operations','vcenter'],['operations','sddc'],['operations','nsx'],
    ['logs','management'],['networks','vcenter'],['networks','nsx'],
    ['management','sddc'],['management','vcenter'],['management','nsx'],
    ['sddc','vcenter'],['sddc','nsx'],['vcenter','esx'],['vcenter','nsx'],['vcenter','vsan'],['vcenter','supervisor'],
    ['nsx','esx'],['nsx','supervisor'],['esx','vsan'],['esx','supervisor'],
    ['esx','depot'],['management','depot'],['depot','infrastructure'],
    ['licensing','vcenter'],['licensing','nsx'],['licensing','private-ai'],['licensing','operations'],['licensing','hcx'],['licensing','identity']
  ].map(pair => pairKey(...pair)));
  const touching = new Map(COMPONENTS.map(c => [c.id, 0]));
  for (const row of baseRows) for (const id of new Set(topologyPath(row))) touching.set(id, touching.get(id) + 1);
  const connected = new Set(selectedComponents);
  if (selectedComponents.length === 1) for (const link of links) {
    if (link.source === selectedComponents[0]) connected.add(link.destination);
    if (link.destination === selectedComponents[0]) connected.add(link.source);
  }
  const zones = `<rect class="zone zone-fleet" x="25" y="20" width="1450" height="125" rx="14"/><text class="zone-title" x="48" y="48">FLEET SERVICES</text>
    <rect class="zone zone-instance" x="25" y="165" width="900" height="575" rx="14"/><text class="zone-title" x="48" y="195">VCF INSTANCE</text>
    <rect class="zone zone-inner" x="50" y="210" width="850" height="145" rx="10"/><text class="zone-title inner-title" x="70" y="237">MANAGEMENT DOMAIN</text>
    <rect class="zone zone-inner" x="50" y="565" width="850" height="145" rx="10"/><text class="zone-title inner-title" x="70" y="592">WORKLOAD INFRASTRUCTURE</text>
    <rect class="zone zone-platform" x="950" y="165" width="525" height="575" rx="14"/><text class="zone-title" x="975" y="195">PLATFORM SERVICES</text>
    <rect class="zone zone-external" x="25" y="780" width="1450" height="125" rx="14"/><text class="zone-title" x="48" y="810">EXTERNAL SYSTEMS & SERVICES</text>`;
  const edgeLabels = [];
  const lineSvg = links.map(link => {
    const exact = selectedComponents.length === 2 && selectedComponents.includes(link.source) && selectedComponents.includes(link.destination);
    const incident = selectedComponents.length === 1 && (link.source === selectedComponents[0] || link.destination === selectedComponents[0]);
    const structural = selectedComponents.length === 0 && backbone.has(pairKey(link.source,link.destination));
    if (!exact && !incident && !structural) return '';
    const a=componentById.get(link.source), b=componentById.get(link.destination);
    const acx=a.x+a.w/2, acy=a.y+32, bcx=b.x+b.w/2, bcy=b.y+32, dx=bcx-acx, dy=bcy-acy;
    const boundaryA=Math.min(dx ? (a.w/2-10)/Math.abs(dx) : Infinity, dy ? 27/Math.abs(dy) : Infinity);
    const boundaryB=Math.min(dx ? (b.w/2-10)/Math.abs(dx) : Infinity, dy ? 27/Math.abs(dy) : Infinity);
    const x1=acx+dx*boundaryA, y1=acy+dy*boundaryA, x2=bcx-dx*boundaryB, y2=bcy-dy*boundaryB;
    const horizontal=Math.abs(dx)>Math.abs(dy), mx=(x1+x2)/2, my=(y1+y2)/2;
    const path=horizontal ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
    const markers = `${link.directions.has(`${link.destination}>${link.source}`) ? ' marker-start="url(#path-arrow)"' : ''}${link.directions.has(`${link.source}>${link.destination}`) ? ' marker-end="url(#path-arrow)"' : ''}`;
    const ports=[...link.ports].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
    const label=exact ? `${ports.slice(0,3).map(port=>port.replace(' / ','/')).join(' · ')}${ports.length>3?` · +${ports.length-3}`:''}` : incident ? `${ports.length} port / protocol ${ports.length===1?'label':'labels'}` : '';
    if (label) edgeLabels.push(`<text class="edge-label" x="${mx}" y="${my-8}">${escape(label)}</text>`);
    return `<g class="edge ${exact||incident?'highlighted':'backbone'}" data-source="${link.source}" data-destination="${link.destination}" tabindex="0" role="button" aria-label="Communication path ${escape(a.name)} and ${escape(b.name)}: ${link.count} entries, ${ports.length} port and protocol labels"><title>${escape(`${a.name} ↔ ${b.name}: ${ports.join(', ')}`)}</title><path class="link-hit" d="${path}"/><path class="link" d="${path}"${markers}/></g>`;
  }).join('');
  const nodeSvg = COMPONENTS.map(component => {
    const selected=selectedComponents.includes(component.id), isConnected=connected.has(component.id);
    const state=selected?'selected':isConnected?'connected':selectedComponents.length?'muted':touching.get(component.id)===0?'unavailable':'';
    const lines=splitLabel(component.name), firstY=component.y+(lines.length===1?25:18), cx=component.x+component.w/2;
    return `<g class="node ${state}" data-component="${component.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escape(component.name)}, ${touching.get(component.id)} matching entries"><rect x="${component.x}" y="${component.y}" width="${component.w}" height="64" rx="7"/><text text-anchor="middle" x="${cx}" y="${firstY}">${lines.map((line,index)=>`<tspan x="${cx}" dy="${index?15:0}">${escape(line)}</tspan>`).join('')}<tspan class="node-count" x="${cx}" y="${component.y+53}">${touching.get(component.id)} matching entries</tspan></text></g>`;
  }).join('');
  $('topology').innerHTML = '<defs><filter id="box-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".16"/></filter><marker id="path-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke"/></marker></defs>' + zones + lineSvg + nodeSvg + `<g class="edge-labels" aria-hidden="true">${edgeLabels.join('')}</g>`;
  const selectComponent = id => {
    selectedComponents = selectedComponents.includes(id) ? selectedComponents.filter(value=>value!==id) : selectedComponents.length < 2 ? [...selectedComponents,id] : [id];
    page=sourcePage=destPage=0; render();
  };
  const activate = (element, callback) => {
    element.addEventListener('click',callback);
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callback();}});
  };
  $('topology').querySelectorAll('.node').forEach(node => activate(node,()=>selectComponent(node.dataset.component)));
  $('topology').querySelectorAll('.edge').forEach(edge => activate(edge,()=>{
    selectedComponents=[edge.dataset.source,edge.dataset.destination]; page=sourcePage=destPage=0; render();
  }));
  $('clear-components').disabled = selectedComponents.length === 0;
  $('show-connections').disabled = selectedComponents.length === 0 || filtered.length === 0;
  $('component-selection').textContent = selectedComponents.length === 0
    ? 'No component selected — showing the core infrastructure backbone. Select any component to draw every matching direct path.'
    : selectedComponents.length === 1
      ? `${componentById.get(selectedComponents[0]).name} selected — ${connected.size-1} direct component paths are drawn. Select a connected box or path to isolate it.`
      : `${componentById.get(selectedComponents[0]).name} ↔ ${componentById.get(selectedComponents[1]).name} — ${filtered.length} direct source entries. Ports are labelled on the path and listed below by direction.`;
  if (!selectedComponents.length) {
    $('path-ports').innerHTML='<div class="data-heading"><div><h2>Selected path ports</h2><p>Select a component or path above to explore its ports by direction.</p></div></div>';
    return;
  }
  const directional = new Map();
  for (const row of filtered) {
    const [source,destination]=topologyPath(row), key=`${source}|${destination}`;
    if (!directional.has(key)) directional.set(key,[]);
    directional.get(key).push(row);
  }
  const groups=[...directional.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>{
    const [source,destination]=key.split('|');
    const ports=uniquePorts(rows);
    const protocols=unique(rows.map(row=>row.protocol || 'Not specified'));
    return `<details class="direction-group" ${selectedComponents.length===2?'open':''}><summary>
      <span class="direction-route"><span>${escape(componentById.get(source).name)}</span><span class="direction-arrow" aria-label="to">→</span><span>${escape(componentById.get(destination).name)}</span></span>
      <span class="direction-counts">${ports.length} port / protocol ${ports.length===1?'label':'labels'} · ${rows.length} ${rows.length===1?'entry':'entries'}</span>
      <span class="direction-preview">${escape(ports.slice(0,4).join(' · '))}${ports.length>4?` · +${ports.length-4} more`:''}</span>
      </summary><div class="protocol-groups">${protocols.map(protocol=>`<div class="protocol-row"><span class="protocol-badge">${escape(protocol)}</span><div>${unique(rows.filter(row=>(row.protocol || 'Not specified')===protocol).map(row=>row.port || 'Not specified')).map(port=>`<span class="port-chip">${escape(port)}</span>`).join('')}</div></div>`).join('')}</div></details>`;
  }).join('');
  $('path-ports').innerHTML=`<div class="data-heading"><div><h2>Selected path ports <span class="count-badge">${uniquePorts(filtered).length} unique port / protocol ${uniquePorts(filtered).length===1?'label':'labels'}</span></h2><p>${directional.size} directions · ${filtered.length} published entries. Expand a direction to see all ports, grouped by protocol.</p></div>${directional.size?'<button id="toggle-paths" class="btn btn-sm" type="button">Expand all</button>':''}</div><div class="direction-list" tabindex="0" role="region" aria-label="Scrollable port groups by direction">${groups || '<p>No direct published source entries match this selection and the current filters.</p>'}</div><p class="path-note">Counts use exact published labels; port ranges are not expanded. Directions are kept separate and labels can occur on several paths.</p>`;
  const toggle=$('toggle-paths');
  if(toggle) {
    const details=[...$('path-ports').querySelectorAll('details')];
    const updateLabel=()=>{toggle.textContent=details.every(detail=>detail.open)?'Collapse all':'Expand all';};
    details.forEach(detail=>detail.addEventListener('toggle',updateLabel));
    toggle.addEventListener('click',()=>{const open=!details.every(detail=>detail.open);details.forEach(detail=>detail.open=open);updateLabel();});
    updateLabel();
  }
}
async function init() {
  try {
    const response = await fetch('./data/vcf-9.1.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (data.vcfVersion !== '9.1' || !data.rows?.length) throw new Error('Invalid snapshot');
    options('product', data.products.map(p=>({id:p.id,name:p.name})), 'All VCF 9.1 products');
    for (const key of ['protocol','classification','source','destination']) options(key, unique(data.rows.map(r=>r[key]).filter(Boolean)), `All ${key === 'classification' ? 'classifications' : key + 's'}`);
    const params = new URLSearchParams(location.search);
    for (const key of fields.filter(k=>k!=='release')) if (params.has(key)) $(key).value=params.get(key);
    releaseOptions(); if (params.has('release')) $('release').value=params.get('release');
    if (['list','matrix'].includes(params.get('view'))) view=params.get('view');
    selectedComponents=(params.get('components')||'').split(',').filter(id=>componentById.has(id)).slice(0,2);
    $('stats').innerHTML = [[data.rows.length,'Published entries'],[data.products.length,'Mapped products'],[new Set(data.rows.flatMap(r=>[r.source,r.destination])).size,'Source & destination labels'],[new Set(data.rows.map(r=>`${r.port}/${r.protocol}`)).size,'Port / protocol combinations']].map(([n,label])=>`<div class="stat"><strong>${n.toLocaleString('en')}</strong><span>${label}</span></div>`).join('');
    $('provenance').textContent = `Source: ports.broadcom.com · Retrieved ${new Date(data.retrievedAt).toLocaleString('en-GB', {timeZone:'UTC'})} UTC. This is a bundled snapshot, not a live feed.`;
    $('coverage-list').innerHTML=data.products.map(p=>`<div class="coverage-item"><strong>${escape(p.name)}</strong><span class="sub">Mapped: ${p.releases.map(r=>escape(r.name)).join(', ')}<br>${p.rowCount} published entries${p.rowCount ? '' : ' — no matching data available'}</span></div>`).join('');
    fields.forEach(key => $(key).addEventListener(key==='search'?'input':'change',()=>{
      if(key==='product') releaseOptions();
      page=sourcePage=destPage=0; render();
    }));
    $('reset').addEventListener('click',()=>{fields.forEach(k=>$(k).value='');selectedComponents=[];releaseOptions();page=sourcePage=destPage=0;render();});
    $('clear-components').addEventListener('click',()=>{selectedComponents=[];page=sourcePage=destPage=0;render();});
    $('show-connections').addEventListener('click',()=>{view='list';page=0;render();$('list-tab').focus();});
    for (const v of ['diagram','list','matrix']) $(`${v}-tab`).addEventListener('click',()=>{view=v;render();});
    $('matrix-order').addEventListener('change',()=>{sourcePage=destPage=0;renderMatrix();});
    for (const id of ['list-sort','list-order','list-size']) $(id).addEventListener('change',()=>{page=0;renderList();});
    $('prev').addEventListener('click',()=>{page--;render();}); $('next').addEventListener('click',()=>{page++;render();});
    for(const [id,change] of [['source-prev',()=>sourcePage--],['source-next',()=>sourcePage++],['dest-prev',()=>destPage--],['dest-next',()=>destPage++]]) $(id).addEventListener('click',()=>{change();renderMatrix();});
    $('export').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([toCSV(filtered)],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='vcf-9.1-filtered-connections.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('status').hidden=true; $('explorer').hidden=false; render();
  } catch(error) {
    $('status').textContent=`Unable to load the data snapshot (${error.message}). Reload to retry. For local use, serve this folder over HTTP instead of opening index.html directly.`;
    $('status').setAttribute('role','alert');
  }
}
init();
