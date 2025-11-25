// density control
const densitySel = document.getElementById('density');
const tableWrap = document.querySelector('#guest-table');
function applyDensity(){
  const val = densitySel?.value || 'cozy';
  tableWrap.classList.toggle('table-density-compact', val==='compact');
  tableWrap.classList.toggle('table-density-cozy', val!=='compact');
}
if (densitySel){
  densitySel.addEventListener('change', applyDensity);
  applyDensity();
}
// planner.js — Wedding Guest Planner (bright theme) using Tabulator
// Extra: analytics stats and saved views
const kpi = {
  total: document.getElementById('kpi-total'),
  families: document.getElementById('kpi-families'),
  plus: document.getElementById('kpi-plus'),
  yes: document.getElementById('kpi-yes'),
  no: document.getElementById('kpi-no'),
};

function computeStats(data){
  const total = data.length;
  const families = new Set(data.map(d => (d.familyName||'').trim()).filter(Boolean)).size;
  const plus = data.reduce((s,d)=> s + (Number(d.plusOnesAllowed||0) > 0 ? 1 : 0), 0);
  const yes = data.filter(d => d.rsvpStatus==='yes').length;
  const pendingNo = total - yes;
  if (kpi.total) kpi.total.textContent = total;
  if (kpi.families) kpi.families.textContent = families;
  if (kpi.plus) kpi.plus.textContent = plus;
  if (kpi.yes) kpi.yes.textContent = yes;
  if (kpi.no) kpi.no.textContent = pendingNo;
}

function refreshKPIs(){ computeStats(table.getData()); }

// Saved views
const viewChips = Array.from(document.querySelectorAll('.views .chip'));
viewChips.forEach(ch => ch.addEventListener('click', () => {
  viewChips.forEach(c=>c.classList.remove('active'));
  ch.classList.add('active');
  const v = ch.dataset.view;
  switch(v){
    case 'bride': table.setFilter('side', '=', 'bride'); break;
    case 'groom': table.setFilter('side', '=', 'groom'); break;
    case 'plus': table.setFilter((row)=> Number(row.getData().plusOnesAllowed||0) > 0 ); break;
    case 'unassigned': table.setFilter((row)=> Number(row.getData().tableNumber||0) === 0 ); break;
    default: table.clearFilter();
  }
  refreshKPIs();
}));

const $ = (s, r=document) => r.querySelector(s);

const ui = {
  table: $('#guest-table'),
  add: $('#add-guest'),
  export: $('#export-guests'),
  import: $('#import-guests'),
  groupFamily: $('#group-by'),
  groupTable: $('#group-by-table'),
  modal: $('#guest-modal'),
  form: $('#guest-form'),
  modalTitle: $('#modal-title'),
};

// Starter demo data
let guests = [
  { id: 'g-1', name: 'Jordan Lee', side: 'groom', relationship: 'Cousin', familyName: 'Lee', tableNumber: 3, plusOnesAllowed: 1, plusOneName: 'Avery Kim', notes: '' },
  { id: 'g-2', name: 'Taylor Smith', side: 'bride', relationship: 'Friend', familyName: 'Smith', tableNumber: 5, plusOnesAllowed: 0, plusOneName: '', notes: 'Vegetarian' },
  { id: 'g-3', name: 'Morgan Patel', side: 'both', relationship: 'Coworker', familyName: 'Patel', tableNumber: 2, plusOnesAllowed: 1, plusOneName: '', notes: '' },
];

let table = new Tabulator(ui.table, {
  height: 600,
  data: guests,
  layout: 'fitDataStretch',
  reactiveData: true,
  placeholder: 'No guests yet — add your first guest!',
  persistenceMode: true,
  persistenceID: 'guest-planner-v2',
  movableColumns: true,
  clipboard: true,
  columnDefaults:{ headerHozAlign:'left', headerSort:true },
  columns: [
    { title: 'Name', field: 'name', editor:'input', headerFilter:'input', widthGrow:2 },
    { title: 'Side', field: 'side', editor:'select', headerFilter:true, editorParams:{values:{bride:'Bride', groom:'Groom', both:'Both'}}, width:120 },
    { title: 'Relationship', field: 'relationship', editor:'input', headerFilter:'input', width:160 },
    { title: 'Family', field: 'familyName', editor:'input', headerFilter:'input', width:150 },
    { title: 'Table', field: 'tableNumber', editor:'number', sorter:'number', width:90, hozAlign:'center' },
    { title: 'Plus-ones', field: 'plusOnesAllowed', editor:'number', sorter:'number', width:110, hozAlign:'center' },
    { title: 'Plus one name', field: 'plusOneName', editor:'input', headerFilter:'input', widthGrow:1 },
    { title: 'Notes', field: 'notes', editor:'input', widthGrow:2 },
    { title: 'Actions', width:120, headerSort:false, hozAlign:'center', formatter: () =>
        `<button class="btn outline" data-act="edit">Edit</button> <button class="btn" style="border-color:#fca5a5" data-act="del">Delete</button>`,
      cellClick: (e, cell) => {
        const act = e.target?.getAttribute('data-act');
        const row = cell.getRow();
        if (act === 'edit') openModal(row.getData());
        if (act === 'del') { if (confirm('Remove this guest?')) row.delete(); }
      }
    },
  ],
});
refreshKPIs();

function applyGrouping(){
  if (ui.groupTable.checked) { table.setGroupBy('tableNumber'); return; }
  if (ui.groupFamily.checked) { table.setGroupBy('familyName'); return; }
  table.setGroupBy(false);
}
ui.groupFamily.addEventListener('change', () => {
  if (ui.groupFamily.checked) ui.groupTable.checked = false;
  applyGrouping();
});
ui.groupTable.addEventListener('change', () => {
  if (ui.groupTable.checked) ui.groupFamily.checked = false;
  applyGrouping();
});

ui.add.addEventListener('click', () => openModal());
function openModal(guest){
  ui.modalTitle.textContent = guest ? 'Edit guest' : 'Add guest';
  ui.form.dataset.editId = guest?.id || '';
  ui.form.name.value = guest?.name || '';
  ui.form.side.value = guest?.side || 'bride';
  ui.form.relationship.value = guest?.relationship || '';
  ui.form.familyName.value = guest?.familyName || '';
  ui.form.tableNumber.value = guest?.tableNumber ?? '';
  ui.form.plusOnesAllowed.value = guest?.plusOnesAllowed ?? 0;
  ui.form.plusOneName.value = guest?.plusOneName || '';
  ui.form.notes.value = guest?.notes || '';
  ui.modal.showModal();
}

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(ui.form);
  const p = Object.fromEntries(fd.entries());
  const editId = ui.form.dataset.editId;
  const record = {
    id: editId || `local-${Date.now()}`,
    name: p.name.trim(),
    side: p.side,
    relationship: (p.relationship||'').trim(),
    familyName: (p.familyName||'').trim(),
    tableNumber: Number(p.tableNumber||0),
    plusOnesAllowed: Number(p.plusOnesAllowed||0),
    plusOneName: (p.plusOneName||'').trim(),
    notes: (p.notes||'').trim(),
  };
  refreshKPIs();
  if (editId){
    const row = table.getRow(editId);
    if (row) row.update(record);
  } else {
    table.addRow(record, true);
  }
  ui.modal.close();
  ui.form.reset();
});

ui.export.addEventListener('click', () => table.download('csv', 'guest-list.csv'));

ui.import.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const text = await f.text();
  const rows = csvParse(text);
  const mapped = rows.map(r => ({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    name: r.name || r.Name,
    side: (r.side || r.Side || 'bride').toLowerCase(),
    relationship: r.relationship || r.Relationship || '',
    familyName: r.familyName || r['family'] || '',
    tableNumber: Number(r.tableNumber || r['table'] || 0),
    plusOnesAllowed: Number(r.plusOnesAllowed || r['plusOnes'] || 0),
    plusOneName: r.plusOneName || r['plusOne'] || '',
    notes: r.notes || '',
  }));
  refreshKPIs();
  table.addData(mapped, true);
  e.target.value = '';
});

function csvParse(text){
  const rows = [];
  let i=0, field='', row=[], inQ=false;
  while(i < text.length){
    const c = text[i++];
    if (inQ){
      if (c==='"'){
        if (text[i]==='"'){ field+='"'; i++; } else inQ=false;
      } else field+=c;
    } else {
      if (c==='"') inQ=true;
      else if (c===','){ row.push(field); field=''; }
      else if (c==='\n' || c==='\r'){
        if (field || row.length){ row.push(field); rows.push(row); }
        if (text[i]==='\n') i++;
        field=''; row=[];
      } else field+=c;
    }
  }
  if (field || row.length){ row.push(field); rows.push(row); }
  const header = (rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.length).map(r => Object.fromEntries(header.map((h,idx)=>[h, r[idx]])));
}
