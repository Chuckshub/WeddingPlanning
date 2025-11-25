// planner.js — Wedding Guest Planner (static demo) using Tabulator
// Tightened visual design; plan guests with sorting, grouping, and CSV import/export.

const $ = (s, r=document) => r.querySelector(s);

// UI refs
const ui = {
  table: $('#guest-table'),
  add: $('#add-guest'),
  export: $('#export-guests'),
  import: $('#import-guests'),
  group: $('#group-by-family'),
  modal: $('#guest-modal'),
  form: $('#guest-form'),
  modalTitle: $('#modal-title'),
};

// Demo dataset (can be replaced with Firestore later)
let guests = [
  { id: 'g-1', name: 'Jordan Lee', side: 'groom', relationship: 'Family', familyName: 'Lee', tableNumber: 3, plusOnesAllowed: 1, plusOneName: 'Avery Kim', notes: '' },
  { id: 'g-2', name: 'Taylor Smith', side: 'bride', relationship: 'Friend', familyName: 'Smith', tableNumber: 5, plusOnesAllowed: 0, plusOneName: '', notes: 'Vegetarian' },
  { id: 'g-3', name: 'Morgan Patel', side: 'both', relationship: 'Coworker', familyName: 'Patel', tableNumber: 2, plusOnesAllowed: 1, plusOneName: '', notes: '' },
];

// Initialize Tabulator
let table = new Tabulator(ui.table, {
  height: 580,
  data: guests,
  layout: 'fitColumns',
  reactiveData: true,
  placeholder: 'No guests yet — add your first guest!',
  groupBy: ui.group.checked ? 'familyName' : false,
  columns: [
    { title: 'Name', field: 'name', editor:'input', headerFilter:'input', widthGrow:2 },
    { title: 'Side', field: 'side', editor:'select', headerFilter:true, editorParams:{values:{bride:'Bride', groom:'Groom', both:'Both'}}, width:120 },
    { title: 'Relationship', field: 'relationship', editor:'input', headerFilter:'input', width:160 },
    { title: 'Family', field: 'familyName', editor:'input', headerFilter:'input', width:150 },
    { title: 'Table', field: 'tableNumber', editor:'number', sorter:'number', width:90, hozAlign:'center' },
    { title: 'Plus-ones', field: 'plusOnesAllowed', editor:'number', sorter:'number', width:110, hozAlign:'center' },
    { title: 'Plus one name', field: 'plusOneName', editor:'input', headerFilter:'input', widthGrow:1 },
    { title: 'Notes', field: 'notes', editor:'input', widthGrow:2 },
    { title: 'Actions', field:'actions', width:120, headerSort:false, hozAlign:'center', formatter: (_,cell)=>{
        return `<button class=\"btn outline\" data-act=\"edit\">Edit</button> <button class=\"btn danger\" data-act=\"del\">Delete</button>`;
      },
      cellClick: (e, cell) => {
        const act = e.target?.getAttribute('data-act');
        const row = cell.getRow();
        if (act === 'edit') openModal(row.getData());
        if (act === 'del') { if (confirm('Remove this guest?')) row.delete(); }
      }
    },
  ],
});

// Grouping toggle
ui.group.addEventListener('change', () => {
  table.setGroupBy(ui.group.checked ? 'familyName' : false);
});

// Add guest via modal
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
  const payload = Object.fromEntries(fd.entries());
  const editId = ui.form.dataset.editId;
  const record = {
    id: editId || `local-${Date.now()}`,
    name: payload.name.trim(),
    side: payload.side,
    relationship: payload.relationship?.trim() || '',
    familyName: payload.familyName?.trim() || '',
    tableNumber: Number(payload.tableNumber||0),
    plusOnesAllowed: Number(payload.plusOnesAllowed||0),
    plusOneName: payload.plusOneName?.trim() || '',
    notes: payload.notes?.trim() || '',
  };
  if (editId){
    const row = table.getRow(editId);
    if (row) row.update(record);
  } else {
    table.addRow(record, true);
  }
  ui.modal.close();
  ui.form.reset();
});

// Export CSV
ui.export.addEventListener('click', () => {
  table.download('csv', 'guest-list.csv');
});

// Import CSV (basic)
ui.import.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
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
  table.addData(mapped, true);
  e.target.value = '';
});

// Simple CSV parser
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
