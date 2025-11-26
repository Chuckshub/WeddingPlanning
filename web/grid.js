// grid.js — Guest Data Studio for Mandy & Charlie
// Futuristic, highly-usable guest planner with Tabulator + Excel features

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ui = {
  tableEl: $('#guest-table'),
  search: $('#global-search'),
  add: $('#add-guest'),
  del: $('#bulk-delete'),
  import: $('#import-guests'),
  exportCSV: $('#export-csv'),
  exportXLSX: $('#export-xlsx'),
  density: $('#density'),
  viewChips: $$('#view-chips .chip'),
  groupChips: $$('#grouping-chips .chip'),
  sideFilter: $('#filter-side'),
  rsvpFilter: $('#filter-rsvp'),
  tableFilter: $('#filter-table'),
  clearFilters: $('#clear-filters'),
  columnManager: $('#column-manager'),
  activeFilters: $('#active-filters'),
  stats: {
    guests: $('#stat-guests'),
    seats: $('#stat-seats'),
    unassigned: $('#stat-unassigned'),
    plus: $('#stat-plus'),
  },
  modal: $('#guest-modal'),
  form: $('#guest-form'),
  modalTitle: $('#modal-title'),
};

const state = {
  filters: {
    search: '',
    view: 'all',
    side: 'all',
    rsvp: 'all',
    table: 'all',
  },
  grouping: 'none',
};

const sampleGuests = [
  { id: 'guest-001', name: 'Jordan Lee', email: 'jordan@example.com', side: 'groom', relationship: 'Cousin', familyName: 'Lee', tableNumber: 3, plusOnesAllowed: 1, plusOneName: 'Avery Kim', rsvpStatus: 'yes', tags: ['Family', 'Austin'], notes: 'Arrives Thursday afternoon.' },
  { id: 'guest-002', name: 'Taylor Smith', email: 'taylor@example.com', side: 'bride', relationship: 'Friend', familyName: 'Smith', tableNumber: 0, plusOnesAllowed: 0, plusOneName: '', rsvpStatus: 'none', tags: ['Bridal party'], notes: 'Maid of honor rehearsal Friday 5pm.' },
  { id: 'guest-003', name: 'Morgan Patel', email: 'morgan@northwind.io', side: 'both', relationship: 'Coworker', familyName: 'Patel', tableNumber: 6, plusOnesAllowed: 1, plusOneName: '', rsvpStatus: 'maybe', tags: ['Tech'], notes: 'Allergic to shellfish.' },
  { id: 'guest-004', name: 'Sofia Alvarez', email: 'sofia@gather.co', side: 'bride', relationship: 'College friend', familyName: 'Alvarez', tableNumber: 0, plusOnesAllowed: 1, plusOneName: '', rsvpStatus: 'yes', tags: ['VIP', 'Bridesmaid'], notes: 'Needs hotel shuttle pickup.' },
  { id: 'guest-005', name: 'Chris Johnson', email: 'chrisj@example.com', side: 'groom', relationship: 'Best man', familyName: 'Johnson', tableNumber: 1, plusOnesAllowed: 0, plusOneName: '', rsvpStatus: 'yes', tags: ['VIP', 'Groomsman'], notes: 'Speech notes on day-of.' },
  { id: 'guest-006', name: 'Aisha Khan', email: 'aisha.khan@example.com', side: 'bride', relationship: 'Family', familyName: 'Khan', tableNumber: 5, plusOnesAllowed: 2, plusOneName: 'Summers Khan', rsvpStatus: 'no', tags: ['Family'], notes: 'Sending gift instead.' },
  { id: 'guest-007', name: 'Daniel Wu', email: 'daniel@productlab.io', side: 'both', relationship: 'Coworker', familyName: 'Wu', tableNumber: 4, plusOnesAllowed: 0, plusOneName: '', rsvpStatus: 'yes', tags: ['Tech', 'VIP'], notes: 'Key investor, seat near couple.' },
  { id: 'guest-008', name: 'Amelia Brooks', email: 'amelia@paperlane.co', side: 'groom', relationship: 'Friend', familyName: 'Brooks', tableNumber: 2, plusOnesAllowed: 1, plusOneName: 'Jamie Brooks', rsvpStatus: 'maybe', tags: ['Travel'], notes: 'Flying in Saturday morning.' },
];

let editingRow = null;

const table = new Tabulator(ui.tableEl, {
  height: '70vh',
  data: sampleGuests,
  layout: 'fitDataStretch',
  reactiveData: true,
  placeholder: 'No guests yet — add one or import a CSV.',
  selectable: true,
  movableColumns: true,
  clipboard: true,
  groupHeader: groupHeader,
  columnDefaults: { headerHozAlign: 'left', headerSort: true, vertAlign: 'middle' },
  columns: [
    {
      title: 'Guest',
      columns: [
        { title: '#', field: 'id', width: 80, hozAlign: 'center', frozen: true },
        { title: 'Name', field: 'name', editor: 'input', headerFilter: 'input', widthGrow: 2, frozen: true },
        { title: 'Email', field: 'email', editor: 'input', headerFilter: 'input', widthGrow: 2 },
        { title: 'Side', field: 'side', editor: 'select', headerFilter: true, width: 110, editorParams: { values: { bride: 'Bride', groom: 'Groom', both: 'Both' } }, formatter: titleCaseFormatter },
        { title: 'Relationship', field: 'relationship', editor: 'input', headerFilter: 'input', widthGrow: 1.5 },
        { title: 'Family', field: 'familyName', editor: 'input', headerFilter: 'input', widthGrow: 1.2 },
      ],
    },
    {
      title: 'Seating',
      columns: [
        { title: 'Table', field: 'tableNumber', editor: 'number', sorter: 'number', width: 100, hozAlign: 'center', formatter: tableFormatter },
        { title: 'Plus-one seats', field: 'plusOnesAllowed', editor: 'number', sorter: 'number', width: 130, hozAlign: 'center' },
        { title: 'Plus one name', field: 'plusOneName', editor: 'input', headerFilter: 'input', widthGrow: 1.4 },
      ],
    },
    {
      title: 'Status',
      columns: [
        { title: 'RSVP', field: 'rsvpStatus', width: 120, hozAlign: 'center', editor: 'select', editorParams: { values: { none: 'No response', yes: 'Yes', no: 'No', maybe: 'Maybe' } }, formatter: rsvpFormatter },
        { title: 'Tags', field: 'tags', widthGrow: 1.6, formatter: tagsFormatter, mutatorEdit: tagMutator },
      ],
    },
    { title: 'Notes', field: 'notes', editor: 'textarea', widthGrow: 2 },
  ],
});

// --- Formatting helpers ----------------------------------------------------

function titleCaseFormatter(cell) {
  const value = cell.getValue();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function tableFormatter(cell) {
  const value = Number(cell.getValue() || 0);
  return value === 0 ? '—' : `Table ${value}`;
}

function rsvpFormatter(cell) {
  const value = (cell.getValue() || 'none').toLowerCase();
  const map = {
    yes: { text: 'Yes', cls: 'badge badge-yes' },
    no: { text: 'No', cls: 'badge badge-no' },
    maybe: { text: 'Maybe', cls: 'badge badge-maybe' },
    none: { text: 'No response', cls: 'badge badge-none' },
  };
  const { text, cls } = map[value] || map.none;
  return `<span class="${cls}">${text}</span>`;
}

function tagsFormatter(cell) {
  const tags = cell.getValue();
  if (!tags || !tags.length) return '';
  return `<span class="tag-list">${tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</span>`;
}

function tagMutator(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function escapeHtml(str) {
  return String(str)
    .replace(/[&<>"]+/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s] || s));
}

function groupHeader(value, count, rows) {
  const seats = rows.reduce((sum, row) => sum + 1 + (Number(row.plusOnesAllowed) || 0), 0);
  const label = value ? escapeHtml(value) : 'Unassigned';
  return `${label} · ${count} guest${count === 1 ? '' : 's'} · ${seats} seat${seats === 1 ? '' : 's'}`;
}

// --- Filtering --------------------------------------------------------------

function matchesQuickView(data, view) {
  switch (view) {
    case 'bride':
      return data.side === 'bride';
    case 'groom':
      return data.side === 'groom';
    case 'both':
      return data.side === 'both';
    case 'plus':
      return Number(data.plusOnesAllowed || 0) > 0;
    case 'vip':
      return (data.tags || []).some(tag => tag.toLowerCase() === 'vip');
    case 'needs-table':
      return Number(data.tableNumber || 0) === 0;
    default:
      return true;
  }
}

function applyFilters() {
  table.setFilter(row => {
    const data = row.getData();
    const { search, view, side, rsvp, table: tableStatus } = state.filters;

    if (view !== 'all' && !matchesQuickView(data, view)) return false;
    if (side !== 'all' && data.side !== side) return false;
    if (rsvp !== 'all' && (data.rsvpStatus || 'none') !== rsvp) return false;
    if (tableStatus === 'assigned' && Number(data.tableNumber || 0) === 0) return false;
    if (tableStatus === 'unassigned' && Number(data.tableNumber || 0) !== 0) return false;
    if (search) {
      const haystack = [
        data.name,
        data.email,
        data.side,
        data.relationship,
        data.familyName,
        data.plusOneName,
        data.notes,
        (data.tags || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  refreshStats();
  renderActiveFilters();
}

function renderActiveFilters() {
  if (!ui.activeFilters) return;
  ui.activeFilters.innerHTML = '';
  const tokens = [];
  const { search, view, side, rsvp, table } = state.filters;

  const viewLabels = {
    bride: 'Bride side',
    groom: 'Groom side',
    both: 'Both sides',
    plus: 'Has plus-one',
    vip: 'VIP',
    'needs-table': 'Needs table',
  };
  if (view !== 'all') tokens.push(`View · ${viewLabels[view] || view}`);
  if (side !== 'all') tokens.push(`Side · ${titleCase(side)}`);
  if (rsvp !== 'all') tokens.push(`RSVP · ${titleCase(rsvp)}`);
  if (table !== 'all') tokens.push(table === 'assigned' ? 'Table · Assigned' : 'Table · Unassigned');
  if (search) tokens.push(`Search · "${search}"`);

  tokens.forEach(token => {
    const span = document.createElement('span');
    span.className = 'filter-token';
    span.textContent = token;
    ui.activeFilters.appendChild(span);
  });
}

function titleCase(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Stats ------------------------------------------------------------------

function refreshStats() {
  const rows = table.getData('active');
  const totalGuests = rows.length;
  const totalSeats = rows.reduce((sum, guest) => sum + 1 + (Number(guest.plusOnesAllowed) || 0), 0);
  const plusSeats = rows.reduce((sum, guest) => sum + (Number(guest.plusOnesAllowed) || 0), 0);
  const unassigned = rows.filter(guest => Number(guest.tableNumber || 0) === 0).length;

  if (ui.stats.guests) ui.stats.guests.textContent = totalGuests;
  if (ui.stats.seats) ui.stats.seats.textContent = totalSeats;
  if (ui.stats.plus) ui.stats.plus.textContent = plusSeats;
  if (ui.stats.unassigned) ui.stats.unassigned.textContent = unassigned;
}

// --- Density ----------------------------------------------------------------

function applyDensity() {
  const compact = ui.density?.value === 'compact';
  ui.tableEl.classList.toggle('table-density-compact', compact);
  ui.tableEl.classList.toggle('table-density-cozy', !compact);
}

ui.density?.addEventListener('change', () => {
  applyDensity();
  table.redraw(true);
});

applyDensity();

// --- Grouping ----------------------------------------------------------------

ui.groupChips.forEach(chip => {
  chip.addEventListener('click', () => {
    ui.groupChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const group = chip.dataset.group || 'none';
    state.grouping = group;
    table.setGroupBy(group === 'none' ? false : group);
  });
});

table.setGroupBy(false);

// --- Quick views -----------------------------------------------------------

ui.viewChips.forEach(chip => {
  chip.addEventListener('click', () => {
    ui.viewChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.filters.view = chip.dataset.view || 'all';
    applyFilters();
  });
});

// --- Select filters ---------------------------------------------------------

ui.sideFilter?.addEventListener('change', () => {
  state.filters.side = ui.sideFilter.value;
  applyFilters();
});

ui.rsvpFilter?.addEventListener('change', () => {
  state.filters.rsvp = ui.rsvpFilter.value;
  applyFilters();
});

ui.tableFilter?.addEventListener('change', () => {
  state.filters.table = ui.tableFilter.value;
  applyFilters();
});

ui.clearFilters?.addEventListener('click', () => {
  state.filters = { search: '', view: 'all', side: 'all', rsvp: 'all', table: 'all' };
  ui.search.value = '';
  ui.sideFilter.value = 'all';
  ui.rsvpFilter.value = 'all';
  ui.tableFilter.value = 'all';
  ui.viewChips.forEach(chip => chip.classList.toggle('active', (chip.dataset.view || 'all') === 'all'));
  applyFilters();
});

// --- Search -----------------------------------------------------------------

ui.search?.addEventListener('input', e => {
  state.filters.search = e.target.value.trim().toLowerCase();
  applyFilters();
});

window.addEventListener('keydown', e => {
  if (e.key === '/' && !isTypingInField(document.activeElement)) {
    e.preventDefault();
    ui.search?.focus();
  }
  if (e.key.toLowerCase() === 'n' && !isTypingInField(document.activeElement)) {
    e.preventDefault();
    openModal();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isTypingInField(document.activeElement)) {
    if (!ui.del?.disabled) bulkDelete();
  }
});

function isTypingInField(active) {
  return active && ['INPUT', 'TEXTAREA'].includes(active.tagName);
}

// --- Column manager ---------------------------------------------------------

function renderColumnManager() {
  if (!ui.columnManager) return;
  const columns = table.getColumns();
  ui.columnManager.innerHTML = '';
  columns.forEach(column => {
    const def = column.getDefinition();
    if (!def.field || def.field.startsWith('_')) return;
    const wrapper = document.createElement('label');
    wrapper.className = 'column-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = column.isVisible();
    input.dataset.field = def.field;
    input.addEventListener('change', () => {
      if (input.checked) column.show();
      else column.hide();
    });
    const span = document.createElement('span');
    span.textContent = def.title;
    wrapper.append(input, span);
    ui.columnManager.appendChild(wrapper);
  });
}

renderColumnManager();

table.on('columnVisibilityChanged', renderColumnManager);

// --- Selection + stats updates ---------------------------------------------

table.on('rowSelectionChanged', rows => {
  if (ui.del) ui.del.disabled = rows.length === 0;
});

table.on('dataProcessed', refreshStats);
table.on('rowAdded', refreshStats);
table.on('rowDeleted', refreshStats);
table.on('cellEdited', () => {
  refreshStats();
  applyFilters();
});

table.on('rowDblClick', (e, row) => {
  openModal(row);
});

refreshStats();
applyFilters();

// --- Modal form -------------------------------------------------------------

ui.add?.addEventListener('click', () => openModal());

ui.form?.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(ui.form);
  const payload = {
    name: form.get('name').trim(),
    email: form.get('email').trim(),
    side: form.get('side'),
    relationship: form.get('relationship').trim(),
    familyName: form.get('familyName').trim(),
    tableNumber: Number(form.get('tableNumber') || 0),
    plusOnesAllowed: Number(form.get('plusOnesAllowed') || 0),
    plusOneName: form.get('plusOneName').trim(),
    rsvpStatus: form.get('rsvpStatus'),
    tags: tagMutator(form.get('tags')),
    notes: form.get('notes').trim(),
  };

  if (editingRow) {
    editingRow.update({ ...editingRow.getData(), ...payload });
  } else {
    const record = { id: `guest-${Date.now().toString(36)}`, ...payload };
    table.addData([record], true);
  }

  ui.modal.close();
  ui.form.reset();
  editingRow = null;
  applyFilters();
});

ui.modal?.addEventListener('close', () => {
  editingRow = null;
  ui.form?.reset();
});

function openModal(row = null) {
  editingRow = row;
  const data = row ? row.getData() : {
    name: '',
    email: '',
    side: 'bride',
    relationship: '',
    familyName: '',
    tableNumber: 0,
    plusOnesAllowed: 0,
    plusOneName: '',
    rsvpStatus: 'none',
    tags: [],
    notes: '',
  };

  ui.modalTitle.textContent = row ? 'Edit guest' : 'Add guest';
  ui.form.name.value = data.name || '';
  ui.form.email.value = data.email || '';
  ui.form.side.value = data.side || 'bride';
  ui.form.relationship.value = data.relationship || '';
  ui.form.familyName.value = data.familyName || '';
  ui.form.tableNumber.value = Number(data.tableNumber || 0);
  ui.form.plusOnesAllowed.value = Number(data.plusOnesAllowed || 0);
  ui.form.plusOneName.value = data.plusOneName || '';
  ui.form.rsvpStatus.value = data.rsvpStatus || 'none';
  ui.form.tags.value = (data.tags || []).join(', ');
  ui.form.notes.value = data.notes || '';

  ui.modal.showModal();
}

// --- Import / Export --------------------------------------------------------

ui.import?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = csvParse(text);
  const mapped = rows.map(r => ({
    id: `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: r.name || r.Name || '',
    email: r.email || r.Email || '',
    side: (r.side || r.Side || 'bride').toLowerCase(),
    relationship: r.relationship || r.Relationship || '',
    familyName: r.familyName || r.Family || '',
    tableNumber: Number(r.tableNumber || r.Table || 0),
    plusOnesAllowed: Number(r.plusOnesAllowed || r['plus-ones'] || r['PlusOnes'] || 0),
    plusOneName: r.plusOneName || r['plusOne'] || '',
    rsvpStatus: (r.rsvpStatus || r.RSVP || 'none').toLowerCase(),
    tags: tagMutator(r.tags || r.Tags || ''),
    notes: r.notes || r.Notes || '',
  }));

  table.addData(mapped, true);
  event.target.value = '';
  applyFilters();
  alert(`Imported ${mapped.length} guest${mapped.length === 1 ? '' : 's'}.`);
});

ui.exportCSV?.addEventListener('click', () => {
  table.download('csv', 'guest-planner.csv');
});

ui.exportXLSX?.addEventListener('click', () => {
  table.download('xlsx', 'guest-planner.xlsx', { sheetName: 'Guests' });
});

// --- Bulk delete ------------------------------------------------------------

ui.del?.addEventListener('click', bulkDelete);

function bulkDelete() {
  const rows = table.getSelectedRows();
  if (!rows.length) return;
  if (!confirm(`Delete ${rows.length} selected guest${rows.length === 1 ? '' : 's'}?`)) return;
  rows.forEach(row => row.delete());
  applyFilters();
}

// --- CSV Parser -------------------------------------------------------------

function csvParse(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  while (i < text.length) {
    const char = text[i++];
    if (inQuotes) {
      if (char === '"') {
        if (text[i] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (field || row.length) {
        row.push(field);
        rows.push(row);
      }
      if (text[i] === '\n') i++;
      field = '';
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() || []).map(h => h.trim());
  return rows
    .filter(r => r.length)
    .map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}
