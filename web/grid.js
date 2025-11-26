// grid.js — Futuristic big-data style guest organizer (Tabulator + Excel features)

const $ = (s, r=document) => r.querySelector(s);

const ui = {
  el: $('#guest-table'),
  search: $('#global-search'),
  add: $('#add-guest'),
  del: $('#bulk-delete'),
  import: $('#import-guests'),
  exportCSV: $('#export-csv'),
  exportXLSX: $('#export-xlsx'),
  density: $('#density'),
  groupChips: Array.from(document.querySelectorAll('.grouping .chip')),
};

// Sample data
let data = [
  { id:'1', name:'Jordan Lee', email:'jordan@example.com', side:'groom', relationship:'Cousin', familyName:'Lee', tableNumber:3, plusOnesAllowed:1, plusOneName:'Avery', notes:'—' },
  { id:'2', name:'Taylor Smith', email:'taylor@example.com', side:'bride', relationship:'Friend', familyName:'Smith', tableNumber:0, plusOnesAllowed:0, plusOneName:'', notes:'Vegetarian' },
  { id:'3', name:'Morgan Patel', email:'morgan@example.com', side:'both', relationship:'Coworker', familyName:'Patel', tableNumber:2, plusOnesAllowed:1, plusOneName:'', notes:'' },
];

// Global search predicate
function applyGlobalSearch(term){
  if (!term) { table.clearFilter(true); return; }
  const t = term.toLowerCase();
  table.setFilter((row)=>{
    const d = row.getData();
    return [d.name,d.email,d.side,d.relationship,d.familyName,d.plusOneName,d.notes].join(' ').toLowerCase().includes(t);
  });
}

// Group header summary
function groupHeader(value, count, data){
  const seats = data.reduce((s,d)=> s + 1 + (Number(d.plusOnesAllowed)||0), 0);
  return `${value ?? '—'} • ${count} guests • ${seats} seats`;
}

// Tabulator grid
let table = new Tabulator(ui.el, {
  height: window.innerHeight - 200,
  data,
  layout: 'fitDataStretch',
  reactiveData: true,
  placeholder: 'No data — press N to add a row or import CSV',
  selectable: true,
  movableColumns: true,
  resizableRows: false,
  clipboard: true,
  groupHeader: groupHeader,
  columnDefaults: { headerHozAlign:'left', headerSort:true },
  columns: [
    { title:'Guest', columns:[
      { title:'#', field:'id', width:60, hozAlign:'center', frozen:true },
      { title:'Name', field:'name', editor:'input', headerFilter:'input', widthGrow:2, frozen:true },
      { title:'Email', field:'email', editor:'input', headerFilter:'input', widthGrow:2 },
      { title:'Side', field:'side', editor:'select', headerFilter:true, width:120, editorParams:{values:{bride:'Bride',groom:'Groom',both:'Both'}} },
      { title:'Relationship', field:'relationship', editor:'input', headerFilter:'input', width:160 },
      { title:'Family', field:'familyName', editor:'input', headerFilter:'input', width:150 },
    ]},
    { title:'Seating', columns:[
      { title:'Table', field:'tableNumber', editor:'number', sorter:'number', width:100, hozAlign:'center', formatter:(cell)=>{ const v=Number(cell.getValue()||0); return v||'—'; } },
      { title:'Plus‑ones', field:'plusOnesAllowed', editor:'number', sorter:'number', width:120, hozAlign:'center' },
      { title:'Plus one name', field:'plusOneName', editor:'input', headerFilter:'input', widthGrow:1 },
    ]},
    { title:'Notes', field:'notes', editor:'input', widthGrow:2 },
  ],
});

// Density
function applyDensity(){
  const compact = ui.density?.value === 'compact';
  ui.el.classList.toggle('table-density-compact', compact);
  ui.el.classList.toggle('table-density-cozy', !compact);
}
ui.density?.addEventListener('change', applyDensity); applyDensity();

// Group chips
ui.groupChips.forEach(chip => chip.addEventListener('click', () => {
  ui.groupChips.forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  const g = chip.dataset.group;
  if (!g || g==='none') table.setGroupBy(false);
  else table.setGroupBy(g);
}));

// Search
ui.search?.addEventListener('input', (e)=> applyGlobalSearch(e.target.value));
window.addEventListener('keydown', (e)=>{
  if (e.key === '/') { e.preventDefault(); ui.search?.focus(); }
  if (e.key.toLowerCase() === 'n') { e.preventDefault(); addRow(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA'){ bulkDelete(); } }
});

function addRow(){
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
  table.addRow({ id, name:'', email:'', side:'bride', relationship:'', familyName:'', tableNumber:0, plusOnesAllowed:0, plusOneName:'', notes:'' }, true);
}
ui.add?.addEventListener('click', addRow);

function bulkDelete(){
  const rows = table.getSelectedRows();
  if (!rows.length) return alert('Select rows to delete');
  if (confirm(`Delete ${rows.length} selected row(s)?`)) rows.forEach(r=>r.delete());
}
ui.del?.addEventListener('click', bulkDelete);

// Import/Export
ui.import?.addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if (!f) return; const text = await f.text();
  const parsed = csvParse(text);
  const mapped = parsed.map(r => ({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    name: r.name || r.Name || '',
    email: r.email || r.Email || '',
    side: (r.side || r.Side || 'bride').toLowerCase(),
    relationship: r.relationship || r.Relationship || '',
    familyName: r.familyName || r.Family || '',
    tableNumber: Number(r.tableNumber || r.Table || 0),
    plusOnesAllowed: Number(r.plusOnesAllowed || r['PlusOnes'] || 0),
    plusOneName: r.plusOneName || r['PlusOne'] || '',
    notes: r.notes || '',
  }));
  table.addData(mapped, true);
  e.target.value = '';
});
ui.exportCSV?.addEventListener('click', ()=> table.download('csv','guests.csv'));
ui.exportXLSX?.addEventListener('click', ()=> table.download('xlsx','guests.xlsx',{sheetName:'Guests'}));

// CSV parser
function csvParse(text){
  const rows = []; let i=0, field='', row=[], inQ=false;
  while(i<text.length){ const c=text[i++]; if(inQ){ if(c==='"'){ if(text[i]==='"'){ field+='"'; i++; } else inQ=false; } else field+=c; } else { if(c==='"') inQ=true; else if(c===','){ row.push(field); field=''; } else if(c==='\n' || c==='\r'){ if(field||row.length){ row.push(field); rows.push(row); } if(text[i]==='\n') i++; field=''; row=[]; } else field+=c; } }
  if(field||row.length){ row.push(field); rows.push(row); }
  const header = (rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.length).map(r => Object.fromEntries(header.map((h,idx)=>[h, r[idx]])));
}
