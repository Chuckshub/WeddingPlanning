// grid.js — Guest Data Studio (Firebase + CSV, analytics grid)
// Futuristic spreadsheet experience with Mandy & Charlie's full guest schema.

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
  categoryFilter: $('#filter-category'),
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

const firebaseState = {
  enabled: false,
  db: null,
  modules: null,
  unsubscribe: null,
};

const state = {
  filters: {
    search: '',
    view: 'all',
    category: 'all',
    rsvp: 'all',
    table: 'all',
  },
  pendingRecords: null,
};

const sampleGuests = [
  {
    id: 'guest-001',
    actuallyInvited: true,
    guestId: 'A-101',
    firstName: 'Jordan',
    lastName: 'Lee',
    partyGroup: 'Lee Family',
    relationship: 'Cousin',
    inviteCategory: 'family',
    plusOneInvited: true,
    plusOneFirstName: 'Avery',
    plusOneLastName: 'Kim',
    plusOneAttending: true,
    numberOfChildren: 0,
    child1Name: '', child1Age: null,
    child2Name: '', child2Age: null,
    child3Name: '', child3Age: null,
    email: 'jordan@example.com',
    phone: '(512) 555‑0198',
    address: '123 Hilltop Dr, Austin, TX 78701',
    rsvpStatus: 'yes',
    guestAttending: true,
    childrenAttending: 0,
    totalInParty: 2,
    dietaryRestrictions: 'None',
    specialAccommodations: '',
    tableNumber: 3,
    tableName: 'Cedar',
    seatingPriority: 'high',
    notes: 'Arrives Thursday afternoon; hotel downtown.',
  },
  {
    id: 'guest-002',
    actuallyInvited: true,
    guestId: 'B-214',
    firstName: 'Sofia',
    lastName: 'Alvarez',
    partyGroup: 'Bridal Party',
    relationship: 'College friend',
    inviteCategory: 'friend',
    plusOneInvited: true,
    plusOneFirstName: '',
    plusOneLastName: '',
    plusOneAttending: false,
    numberOfChildren: 0,
    child1Name: '', child1Age: null,
    child2Name: '', child2Age: null,
    child3Name: '', child3Age: null,
    email: 'sofia@gather.co',
    phone: '(415) 555‑0194',
    address: '872 Valencia St, San Francisco, CA 94110',
    rsvpStatus: 'none',
    guestAttending: true,
    childrenAttending: 0,
    totalInParty: 1,
    dietaryRestrictions: 'Gluten-free',
    specialAccommodations: 'Needs shuttle pickup from hotel.',
    tableNumber: 0,
    tableName: '',
    seatingPriority: 'high',
    notes: 'Bridesmaid rehearsal Friday 5pm.',
  },
  {
    id: 'guest-003',
    actuallyInvited: true,
    guestId: 'C-045',
    firstName: 'Daniel',
    lastName: 'Wu',
    partyGroup: 'Investor Table',
    relationship: 'Business partner',
    inviteCategory: 'vip',
    plusOneInvited: false,
    plusOneFirstName: '',
    plusOneLastName: '',
    plusOneAttending: false,
    numberOfChildren: 2,
    child1Name: 'Lina', child1Age: 7,
    child2Name: 'Noah', child2Age: 4,
    child3Name: '', child3Age: null,
    email: 'daniel@productlab.io',
    phone: '(917) 555‑0112',
    address: '455 Madison Ave, New York, NY 10022',
    rsvpStatus: 'yes',
    guestAttending: true,
    childrenAttending: 2,
    totalInParty: 3,
    dietaryRestrictions: 'Peanut allergy (child).',
    specialAccommodations: 'Booster seat requested.',
    tableNumber: 6,
    tableName: 'Magnolia',
    seatingPriority: 'high',
    notes: 'Key investor — seat near couple.',
  },
  {
    id: 'guest-004',
    actuallyInvited: false,
    guestId: 'V-009',
    firstName: 'Celeste',
    lastName: 'Nguyen',
    partyGroup: 'Vendors',
    relationship: 'Florist',
    inviteCategory: 'vendor',
    plusOneInvited: false,
    plusOneFirstName: '',
    plusOneLastName: '',
    plusOneAttending: false,
    numberOfChildren: 0,
    child1Name: '', child1Age: null,
    child2Name: '', child2Age: null,
    child3Name: '', child3Age: null,
    email: 'hello@celesteblooms.com',
    phone: '(737) 555‑0120',
    address: '88 Market St, Austin, TX 78702',
    rsvpStatus: 'maybe',
    guestAttending: false,
    childrenAttending: 0,
    totalInParty: 0,
    dietaryRestrictions: '',
    specialAccommodations: 'Needs vendor meal.',
    tableNumber: 0,
    tableName: '',
    seatingPriority: 'standard',
    notes: 'Working timeline TBD.',
  },
];

let tableReady = false;
let editingRow = null;

const table = new Tabulator(ui.tableEl, {
  index: 'id',
  height: '72vh',
  data: [],
  layout: 'fitDataStretch',
  reactiveData: true,
  selectableRows: true,
  movableColumns: true,
  resizableRows: false,
  clipboard: true,
  persistenceMode: true,
  persistenceID: 'guest-data-studio-v1',
  placeholder: 'No guests yet — press “New guest” or import a CSV.',
  columnDefaults: { headerHozAlign: 'left', headerSort: true, vertAlign: 'middle' },
  groupHeader: (value, count, rows) => {
    const seats = rows.reduce((sum, row) => sum + (Number(row.totalInParty) || fallbackPartySize(row)), 0);
    const label = value ? escapeHtml(String(value)) : 'Unassigned';
    return `${label} · ${count} guest${count === 1 ? '' : 's'} · ${seats} seat${seats === 1 ? '' : 's'}`;
  },
  columns: [
    {
      title: 'Invitation',
      columns: [
        { title: 'Actually Invited?', field: 'actuallyInvited', width: 150, hozAlign: 'center', formatter: 'tickCross', editor: 'tickCross' },
        { title: 'Guest ID', field: 'guestId', editor: 'input', headerFilter: 'input', width: 130 },
        { title: 'Party Group', field: 'partyGroup', editor: 'input', headerFilter: 'input', width: 160 },
        { title: 'Relationship', field: 'relationship', editor: 'input', headerFilter: 'input', width: 160 },
        { title: 'Invite Category', field: 'inviteCategory', editor: 'list', headerFilter: true, editorParams: { values: { family: 'Family', friend: 'Friend', vendor: 'Vendor', vip: 'VIP', other: 'Other' } }, width: 150 },
      ],
    },
    {
      title: 'Primary Guest',
      frozen: true,
      columns: [
        { title: 'First Name', field: 'firstName', editor: 'input', headerFilter: 'input', widthGrow: 1.2 },
        { title: 'Last Name', field: 'lastName', editor: 'input', headerFilter: 'input', widthGrow: 1.2 },
        { title: 'Email', field: 'email', editor: 'input', headerFilter: 'input', widthGrow: 1.6 },
        { title: 'Phone', field: 'phone', editor: 'input', width: 160 },
        { title: 'Address', field: 'address', editor: 'textarea', widthGrow: 2.5 },
      ],
    },
    {
      title: 'Plus-One',
      columns: [
        { title: 'Plus One Invited', field: 'plusOneInvited', width: 160, hozAlign: 'center', formatter: 'tickCross', editor: 'tickCross' },
        { title: 'Plus One First Name', field: 'plusOneFirstName', editor: 'input', headerFilter: 'input', widthGrow: 1.2 },
        { title: 'Plus One Last Name', field: 'plusOneLastName', editor: 'input', headerFilter: 'input', widthGrow: 1.2 },
      ],
    },
    {
      title: 'Children',
      columns: [
        { title: 'Number of Children', field: 'numberOfChildren', width: 170, hozAlign: 'center', editor: 'number' },
        { title: 'Child 1 Name', field: 'child1Name', editor: 'input', width: 150 },
        { title: 'Child 1 Age', field: 'child1Age', width: 120, hozAlign: 'center', editor: 'number' },
        { title: 'Child 2 Name', field: 'child2Name', editor: 'input', width: 150 },
        { title: 'Child 2 Age', field: 'child2Age', width: 120, hozAlign: 'center', editor: 'number' },
        { title: 'Child 3 Name', field: 'child3Name', editor: 'input', width: 150 },
        { title: 'Child 3 Age', field: 'child3Age', width: 120, hozAlign: 'center', editor: 'number' },
      ],
    },
    {
      title: 'Attendance & Comfort',
      columns: [
        { title: 'RSVP Status', field: 'rsvpStatus', width: 150, hozAlign: 'center', editor: 'list', editorParams: { values: { none: 'No response', yes: 'Yes', no: 'No', maybe: 'Maybe' } }, formatter: rsvpFormatter },
        { title: 'Guest Attending', field: 'guestAttending', width: 150, hozAlign: 'center', formatter: 'tickCross', editor: 'tickCross' },
        { title: 'Plus One Attending', field: 'plusOneAttending', width: 170, hozAlign: 'center', formatter: 'tickCross', editor: 'tickCross' },
        { title: 'Children Attending', field: 'childrenAttending', width: 170, hozAlign: 'center', editor: 'number' },
        { title: 'Total in Party', field: 'totalInParty', width: 150, hozAlign: 'center', editor: 'number' },
        { title: 'Dietary Restrictions', field: 'dietaryRestrictions', editor: 'textarea', widthGrow: 1.6 },
        { title: 'Special Accommodations', field: 'specialAccommodations', editor: 'textarea', widthGrow: 1.6 },
      ],
    },
    {
      title: 'Seating',
      columns: [
        { title: 'Table Number', field: 'tableNumber', width: 140, hozAlign: 'center', editor: 'number' },
        { title: 'Table Name', field: 'tableName', editor: 'input', widthGrow: 1.2 },
        { title: 'Seating Priority', field: 'seatingPriority', editor: 'list', editorParams: { values: { high: 'High', standard: 'Standard', low: 'Low' } }, width: 150 },
      ],
    },
    { title: 'Notes', field: 'notes', editor: 'textarea', widthGrow: 2.5 },
    {
      title: '',
      field: '_actions',
      width: 150,
      hozAlign: 'center',
      headerSort: false,
      formatter: () => '<div class="table-actions"><button class="btn outline btn-mini" data-act="edit">Edit</button><button class="btn danger btn-mini" data-act="del">Delete</button></div>',
      cellClick: (e, cell) => {
        const action = e.target?.dataset?.act;
        if (action === 'edit') openModal(cell.getRow());
        if (action === 'del') {
          e.stopPropagation();
          handleRowDelete(cell.getRow());
        }
      },
    },
  ],
});

let tableReady = false;

table.on('tableBuilt', () => {
  tableReady = true;
  renderColumnManager();
  if (state.pendingRecords) {
    const records = state.pendingRecords;
    state.pendingRecords = null;
    table.replaceData(records).then(() => applyFilters());
  } else {
    applyFilters();
  }
});

table.on('columnVisibilityChanged', () => {
  if (tableReady) renderColumnManager();
});

table.on('rowSelectionChanged', rows => {
  if (ui.del) ui.del.disabled = rows.length === 0;
});

table.on('dataProcessed', () => {
  refreshStats();
  refreshKPIs();
});

table.on('rowAdded', () => {
  refreshStats();
  refreshKPIs();
});

table.on('rowDeleted', () => {
  refreshStats();
  refreshKPIs();
  applyFilters();
});

table.on('cellEdited', () => {
  refreshStats();
  refreshKPIs();
  applyFilters();
});

table.on('rowDblClick', (e, row) => openModal(row));

// --- Firebase bootstrap ----------------------------------------------------

init();

async function init() {
  const connected = await initFirebase();
  if (!connected) {
    setData(sampleGuests.map(normalizePayload));
  }
}

async function initFirebase() {
  try {
    const res = await fetch('/api/firebase-config');
    if (!res.ok) {
      console.info('[Guest Studio] Firebase config not found (404). Running in demo mode.');
      return false;
    }
    const config = await res.json();
    if (!config?.apiKey) return false;

    const [{ initializeApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js'),
    ]);

    const {
      getFirestore,
      collection,
      doc,
      setDoc,
      addDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      serverTimestamp,
      writeBatch,
    } = firestore;

    const app = initializeApp(config);
    firebaseState.enabled = true;
    firebaseState.db = getFirestore(app);
    firebaseState.modules = { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch };

    subscribeToFirestore();
    return true;
  } catch (err) {
    console.warn('Firebase unavailable, staying in local demo mode.', err);
    firebaseState.enabled = false;
    return false;
  }
}

function subscribeToFirestore() {
  const { collection, onSnapshot } = firebaseState.modules;
  firebaseState.unsubscribe?.();
  const ref = collection(firebaseState.db, 'guests');
  firebaseState.unsubscribe = onSnapshot(ref, snapshot => {
    const records = snapshot.docs.map(deserializeDoc).map(normalizePayload);
    setData(records);
  }, err => console.error('Firestore listener error:', err));
}

function deserializeDoc(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    actuallyInvited: data.actuallyInvited ?? false,
    guestId: data.guestId || docSnap.id,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    partyGroup: data.partyGroup || '',
    relationship: data.relationship || '',
    inviteCategory: data.inviteCategory || 'family',
    plusOneInvited: data.plusOneInvited ?? false,
    plusOneFirstName: data.plusOneFirstName || '',
    plusOneLastName: data.plusOneLastName || '',
    plusOneAttending: data.plusOneAttending ?? false,
    numberOfChildren: data.numberOfChildren ?? 0,
    child1Name: data.child1Name || '',
    child1Age: data.child1Age ?? null,
    child2Name: data.child2Name || '',
    child2Age: data.child2Age ?? null,
    child3Name: data.child3Name || '',
    child3Age: data.child3Age ?? null,
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    rsvpStatus: data.rsvpStatus || 'none',
    guestAttending: data.guestAttending ?? false,
    plusOneAttending: data.plusOneAttending ?? false,
    childrenAttending: data.childrenAttending ?? 0,
    totalInParty: data.totalInParty ?? 0,
    dietaryRestrictions: data.dietaryRestrictions || '',
    specialAccommodations: data.specialAccommodations || '',
    tableNumber: data.tableNumber ?? 0,
    tableName: data.tableName || '',
    seatingPriority: data.seatingPriority || 'standard',
    notes: data.notes || '',
  };
}

function setData(records) {
  state.pendingRecords = records;
  if (!tableReady) return;
  table.replaceData(records).then(() => applyFilters());
}

function docIdFromRecord(record) {
  return (record.guestId && record.guestId.trim()) || record.id || `guest-${Date.now().toString(36)}`;
}

function serializeForFirestore(record) {
  return {
    actuallyInvited: !!record.actuallyInvited,
    guestId: record.guestId || '',
    firstName: record.firstName || '',
    lastName: record.lastName || '',
    partyGroup: record.partyGroup || '',
    relationship: record.relationship || '',
    inviteCategory: record.inviteCategory || 'family',
    plusOneInvited: !!record.plusOneInvited,
    plusOneFirstName: record.plusOneFirstName || '',
    plusOneLastName: record.plusOneLastName || '',
    plusOneAttending: !!record.plusOneAttending,
    numberOfChildren: toNumber(record.numberOfChildren),
    child1Name: record.child1Name || '',
    child1Age: toNumberOrNull(record.child1Age),
    child2Name: record.child2Name || '',
    child2Age: toNumberOrNull(record.child2Age),
    child3Name: record.child3Name || '',
    child3Age: toNumberOrNull(record.child3Age),
    email: record.email || '',
    phone: record.phone || '',
    address: record.address || '',
    rsvpStatus: record.rsvpStatus || 'none',
    guestAttending: !!record.guestAttending,
    plusOneAttending: !!record.plusOneAttending,
    childrenAttending: toNumber(record.childrenAttending),
    totalInParty: toNumber(record.totalInParty),
    dietaryRestrictions: record.dietaryRestrictions || '',
    specialAccommodations: record.specialAccommodations || '',
    tableNumber: toNumber(record.tableNumber),
    tableName: record.tableName || '',
    seatingPriority: record.seatingPriority || 'standard',
    notes: record.notes || '',
  };
}

function normalizePayload(record = {}) {
  const defaults = createBlankRecord();
  const normalized = { ...defaults, ...record };

  normalized.actuallyInvited = toBool(normalized.actuallyInvited);
  normalized.guestId = (normalized.guestId || '').trim();
  normalized.firstName = (normalized.firstName || '').trim();
  normalized.lastName = (normalized.lastName || '').trim();
  normalized.partyGroup = (normalized.partyGroup || '').trim();
  normalized.relationship = (normalized.relationship || '').trim();
  normalized.inviteCategory = (normalized.inviteCategory || 'family').toLowerCase();
  normalized.plusOneInvited = toBool(normalized.plusOneInvited);
  normalized.plusOneFirstName = (normalized.plusOneFirstName || '').trim();
  normalized.plusOneLastName = (normalized.plusOneLastName || '').trim();
  normalized.plusOneAttending = toBool(normalized.plusOneAttending);
  normalized.numberOfChildren = toNumber(normalized.numberOfChildren);
  normalized.child1Name = (normalized.child1Name || '').trim();
  normalized.child2Name = (normalized.child2Name || '').trim();
  normalized.child3Name = (normalized.child3Name || '').trim();
  normalized.child1Age = toNumberOrNull(normalized.child1Age);
  normalized.child2Age = toNumberOrNull(normalized.child2Age);
  normalized.child3Age = toNumberOrNull(normalized.child3Age);
  normalized.email = (normalized.email || '').trim();
  normalized.phone = (normalized.phone || '').trim();
  normalized.address = (normalized.address || '').trim();
  normalized.rsvpStatus = (normalized.rsvpStatus || 'none').toLowerCase();
  normalized.guestAttending = toBool(normalized.guestAttending);
  normalized.childrenAttending = toNumber(normalized.childrenAttending);
  normalized.totalInParty = toNumber(normalized.totalInParty);
  normalized.dietaryRestrictions = (normalized.dietaryRestrictions || '').trim();
  normalized.specialAccommodations = (normalized.specialAccommodations || '').trim();
  normalized.tableNumber = toNumber(normalized.tableNumber);
  normalized.tableName = (normalized.tableName || '').trim();
  normalized.seatingPriority = (normalized.seatingPriority || 'standard').toLowerCase();
  normalized.notes = (normalized.notes || '').trim();

  normalized.id = normalized.id || normalized.guestId || `guest-${Date.now().toString(36)}`;

  if (!normalized.totalInParty) {
    normalized.totalInParty = fallbackPartySize(normalized);
  }

  return normalized;
}

function createBlankRecord() {
  return {
    id: '',
    actuallyInvited: true,
    guestId: '',
    firstName: '',
    lastName: '',
    partyGroup: '',
    relationship: '',
    inviteCategory: 'family',
    plusOneInvited: false,
    plusOneFirstName: '',
    plusOneLastName: '',
    plusOneAttending: false,
    numberOfChildren: 0,
    child1Name: '', child1Age: null,
    child2Name: '', child2Age: null,
    child3Name: '', child3Age: null,
    email: '',
    phone: '',
    address: '',
    rsvpStatus: 'none',
    guestAttending: false,
    plusOneAttending: false,
    childrenAttending: 0,
    totalInParty: 0,
    dietaryRestrictions: '',
    specialAccommodations: '',
    tableNumber: 0,
    tableName: '',
    seatingPriority: 'standard',
    notes: '',
  };
}

// --- UI interactions -------------------------------------------------------

function applyDensity() {
  const compact = ui.density?.value === 'compact';
  ui.tableEl.classList.toggle('table-density-compact', compact);
  ui.tableEl.classList.toggle('table-density-cozy', !compact);
  if (tableReady) table.redraw(true);
}

ui.density?.addEventListener('change', applyDensity);
applyDensity();

ui.groupChips.forEach(chip => {
  chip.addEventListener('click', () => {
    ui.groupChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const group = chip.dataset.group || 'none';
    state.grouping = group;
    if (!tableReady) return;
    table.setGroupBy(group === 'none' ? false : group);
  });
});

ui.viewChips.forEach(chip => {
  chip.addEventListener('click', () => {
    ui.viewChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.filters.view = chip.dataset.view || 'all';
    applyFilters();
  });
});

ui.categoryFilter?.addEventListener('change', () => {
  state.filters.category = ui.categoryFilter.value;
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
  state.filters = { search: '', view: 'all', category: 'all', rsvp: 'all', table: 'all' };
  if (ui.search) ui.search.value = '';
  if (ui.categoryFilter) ui.categoryFilter.value = 'all';
  if (ui.rsvpFilter) ui.rsvpFilter.value = 'all';
  if (ui.tableFilter) ui.tableFilter.value = 'all';
  ui.viewChips.forEach(chip => chip.classList.toggle('active', chip.dataset.view === 'all'));
  applyFilters();
});

ui.search?.addEventListener('input', e => {
  state.filters.search = e.target.value.trim().toLowerCase();
  applyFilters();
});

window.addEventListener('keydown', e => {
  const activeTag = document.activeElement?.tagName;
  const typing = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
  if (e.key === '/' && !typing) {
    e.preventDefault();
    ui.search?.focus();
  }
  if (e.key.toLowerCase() === 'n' && !typing) {
    e.preventDefault();
    openModal();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
    if (!ui.del?.disabled) bulkDelete();
  }
});

// --- Filtering & stats -----------------------------------------------------

function matchesQuickView(guest, view) {
  switch (view) {
    case 'family':
      return (guest.inviteCategory || '').toLowerCase() === 'family';
    case 'friends':
      return (guest.inviteCategory || '').toLowerCase() === 'friend';
    case 'vip':
      return (guest.seatingPriority || '').toLowerCase() === 'high' || (guest.inviteCategory || '').toLowerCase() === 'vip';
    case 'needs-table':
      return Number(guest.tableNumber || 0) === 0;
    default:
      return true;
  }
}

function applyFilters() {
  if (!tableReady) return;
  const { search, view, category, rsvp, table: tableStatus } = state.filters;
  table.clearFilter(true);
  table.setFilter((data) => {
    const guest = data;
    if (view !== 'all' && !matchesQuickView(guest, view)) return false;
    if (category !== 'all' && (guest.inviteCategory || '').toLowerCase() !== category) return false;
    if (rsvp !== 'all' && (guest.rsvpStatus || 'none').toLowerCase() !== rsvp) return false;
    if (tableStatus === 'assigned' && !Number(guest.tableNumber || 0)) return false;
    if (tableStatus === 'unassigned' && Number(guest.tableNumber || 0)) return false;

    if (search) {
      const haystack = [
        guest.firstName,
        guest.lastName,
        guest.partyGroup,
        guest.relationship,
        guest.inviteCategory,
        guest.plusOneFirstName,
        guest.plusOneLastName,
        guest.email,
        guest.phone,
        guest.address,
        guest.dietaryRestrictions,
        guest.specialAccommodations,
        guest.tableName,
        guest.notes,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderActiveFilters();
  refreshStats();
  refreshKPIs();
}

function renderActiveFilters() {
  if (!ui.activeFilters) return;
  ui.activeFilters.innerHTML = '';

  const tokens = [];
  const { search, view, category, rsvp, table } = state.filters;

  const viewLabels = {
    family: 'Family view',
    friends: 'Friends view',
    vip: 'VIP priority',
    'needs-table': 'Needs table',
  };

  if (view !== 'all') tokens.push(viewLabels[view] || view);
  if (category !== 'all') tokens.push(`Category · ${titleCase(category)}`);
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

function refreshStats() {
  if (!tableReady) return;
  const rows = table.getData('active');
  const totalGuests = rows.length;
  const totalSeats = rows.reduce((sum, guest) => sum + (Number(guest.totalInParty) || fallbackPartySize(guest)), 0);
  const plusSeats = rows.reduce((sum, guest) => sum + (guest.plusOneInvited ? 1 : 0), 0);
  const unassigned = rows.filter(guest => Number(guest.tableNumber || 0) === 0).length;

  if (ui.stats.guests) ui.stats.guests.textContent = totalGuests;
  if (ui.stats.seats) ui.stats.seats.textContent = totalSeats;
  if (ui.stats.plus) ui.stats.plus.textContent = plusSeats;
  if (ui.stats.unassigned) ui.stats.unassigned.textContent = unassigned;
}

const kpiTotalEl = document.getElementById('kpi-total');
const kpiFamiliesEl = document.getElementById('kpi-families');
const kpiPlusEl = document.getElementById('kpi-plus');
const kpiYesEl = document.getElementById('kpi-yes');
const kpiNoEl = document.getElementById('kpi-no');

function refreshKPIs() {
  if (!tableReady) return;
  const rows = table.getData('active');
  const families = new Set(rows.map(guest => (guest.partyGroup || `${guest.lastName || ''} family`).trim()).filter(Boolean)).size;
  const plusInvited = rows.reduce((sum, guest) => sum + (guest.plusOneInvited ? 1 : 0), 0);
  const yesCount = rows.filter(row => (row.rsvpStatus || '').toLowerCase() === 'yes').length;
  const pending = rows.length - yesCount;

  if (kpiTotalEl) kpiTotalEl.textContent = rows.length;
  if (kpiFamiliesEl) kpiFamiliesEl.textContent = families;
  if (kpiPlusEl) kpiPlusEl.textContent = plusInvited;
  if (kpiYesEl) kpiYesEl.textContent = yesCount;
  if (kpiNoEl) kpiNoEl.textContent = pending;
}

// --- Column manager --------------------------------------------------------

function renderColumnManager() {
  if (!ui.columnManager || !tableReady) return;
  ui.columnManager.innerHTML = '';
  table.getColumns().forEach(column => {
    const def = column.getDefinition();
    if (!def.field || def.field.startsWith('_')) return;
    const wrapper = document.createElement('label');
    wrapper.className = 'column-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = column.isVisible();
    input.addEventListener('change', () => {
      input.checked ? column.show() : column.hide();
    });
    const span = document.createElement('span');
    span.textContent = def.title;
    wrapper.append(input, span);
    ui.columnManager.appendChild(wrapper);
  });
}

// --- Modal -----------------------------------------------------------------

ui.add?.addEventListener('click', () => openModal());

ui.form?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = ui.form;
  const payload = normalizePayload({
    id: editingRow?.getData()?.id || `guest-${Date.now().toString(36)}`,
    actuallyInvited: form.actuallyInvited.checked,
    guestId: form.guestId.value.trim(),
    firstName: form.firstName.value.trim(),
    lastName: form.lastName.value.trim(),
    partyGroup: form.partyGroup.value.trim(),
    relationship: form.relationship.value.trim(),
    inviteCategory: form.inviteCategory.value,
    plusOneInvited: form.plusOneInvited.checked,
    plusOneFirstName: form.plusOneFirstName.value.trim(),
    plusOneLastName: form.plusOneLastName.value.trim(),
    plusOneAttending: form.plusOneAttending.checked,
    numberOfChildren: form.numberOfChildren.value,
    child1Name: form.child1Name.value.trim(),
    child1Age: form.child1Age.value,
    child2Name: form.child2Name.value.trim(),
    child2Age: form.child2Age.value,
    child3Name: form.child3Name.value.trim(),
    child3Age: form.child3Age.value,
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    rsvpStatus: form.rsvpStatus.value,
    guestAttending: form.guestAttending.checked,
    plusOneAttending: form.plusOneAttending.checked,
    childrenAttending: form.childrenAttending.value,
    totalInParty: form.totalInParty.value,
    dietaryRestrictions: form.dietaryRestrictions.value.trim(),
    specialAccommodations: form.specialAccommodations.value.trim(),
    tableNumber: form.tableNumber.value,
    tableName: form.tableName.value.trim(),
    seatingPriority: form.seatingPriority.value,
    notes: form.notes.value.trim(),
  });

  try {
    if (firebaseState.enabled) {
      await saveToFirestore(payload, { create: !editingRow });
    } else if (editingRow) {
      editingRow.update(payload);
    } else {
      table.addData([payload], true);
    }
  } catch (err) {
    console.error('Save failed', err);
    alert('Failed to save guest. Check console for details.');
    return;
  }

  ui.modal.close();
  form.reset();
  editingRow = null;
  refreshStats();
  refreshKPIs();
  applyFilters();
});

ui.modal?.addEventListener('close', () => {
  editingRow = null;
  ui.form?.reset();
});

function openModal(row = null) {
  editingRow = row;
  const data = normalizePayload(row ? row.getData() : createBlankRecord());
  ui.modalTitle.textContent = row ? 'Edit guest' : 'Add guest';
  const form = ui.form;
  form.actuallyInvited.checked = !!data.actuallyInvited;
  form.guestId.value = data.guestId || '';
  form.firstName.value = data.firstName || '';
  form.lastName.value = data.lastName || '';
  form.partyGroup.value = data.partyGroup || '';
  form.relationship.value = data.relationship || '';
  form.inviteCategory.value = data.inviteCategory || 'family';
  form.plusOneInvited.checked = !!data.plusOneInvited;
  form.plusOneFirstName.value = data.plusOneFirstName || '';
  form.plusOneLastName.value = data.plusOneLastName || '';
  form.plusOneAttending.checked = !!data.plusOneAttending;
  form.numberOfChildren.value = data.numberOfChildren ?? 0;
  form.child1Name.value = data.child1Name || '';
  form.child1Age.value = data.child1Age ?? '';
  form.child2Name.value = data.child2Name || '';
  form.child2Age.value = data.child2Age ?? '';
  form.child3Name.value = data.child3Name || '';
  form.child3Age.value = data.child3Age ?? '';
  form.childrenAttending.value = data.childrenAttending ?? 0;
  form.email.value = data.email || '';
  form.phone.value = data.phone || '';
  form.address.value = data.address || '';
  form.rsvpStatus.value = data.rsvpStatus || 'none';
  form.guestAttending.checked = !!data.guestAttending;
  form.totalInParty.value = data.totalInParty || '';
  form.dietaryRestrictions.value = data.dietaryRestrictions || '';
  form.specialAccommodations.value = data.specialAccommodations || '';
  form.tableNumber.value = data.tableNumber ?? 0;
  form.tableName.value = data.tableName || '';
  form.seatingPriority.value = data.seatingPriority || 'standard';
  form.notes.value = data.notes || '';

  ui.modal.showModal();
}

async function saveToFirestore(record, { create = false } = {}) {
  if (!firebaseState.enabled) return;
  const { doc, setDoc, serverTimestamp } = firebaseState.modules;
  const docId = docIdFromRecord(record);
  const ref = doc(firebaseState.db, 'guests', docId);
  const payload = { ...serializeForFirestore(record), updatedAt: serverTimestamp() };
  if (create) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}

async function batchImport(records) {
  if (!firebaseState.enabled || !records.length) return;
  const { writeBatch, doc, serverTimestamp } = firebaseState.modules;
  const batch = writeBatch(firebaseState.db);
  records.forEach(record => {
    const docId = docIdFromRecord(record);
    const ref = doc(firebaseState.db, 'guests', docId);
    batch.set(ref, { ...serializeForFirestore(record), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}

async function deleteFromFirestore(id) {
  const { doc, deleteDoc } = firebaseState.modules;
  await deleteDoc(doc(firebaseState.db, 'guests', id));
}

function bulkDelete() {
  const rows = table.getSelectedRows();
  if (!rows.length) return;
  if (!confirm(`Delete ${rows.length} selected guest${rows.length === 1 ? '' : 's'}?`)) return;

  if (firebaseState.enabled) {
    Promise.all(rows.map(row => deleteFromFirestore(row.getData().id))).catch(err => {
      console.error('Delete failed', err);
      alert('Failed to delete some guests. Check console for details.');
    });
  } else {
    rows.forEach(row => row.delete());
    refreshStats();
    refreshKPIs();
    applyFilters();
  }
}

function handleRowDelete(row) {
  if (!row) return;
  if (!confirm('Delete this guest?')) return;
  if (firebaseState.enabled) {
    deleteFromFirestore(row.getData().id).catch(err => {
      console.error('Delete failed', err);
      alert('Failed to delete guest. Check console for details.');
    });
  } else {
    row.delete();
    refreshStats();
    refreshKPIs();
    applyFilters();
  }
}

ui.del?.addEventListener('click', bulkDelete);

// --- CSV helpers -----------------------------------------------------------

const csvFieldMap = new Map([
  ['Actually Invited?', 'actuallyInvited'],
  ['Guest_ID', 'guestId'],
  ['First_Name', 'firstName'],
  ['Last_Name', 'lastName'],
  ['Party_Group', 'partyGroup'],
  ['Relationship', 'relationship'],
  ['Invite_Category', 'inviteCategory'],
  ['Plus_One_Invited', 'plusOneInvited'],
  ['Plus_One_First_Name', 'plusOneFirstName'],
  ['Plus_One_Last_Name', 'plusOneLastName'],
  ['Plus_One_Attending', 'plusOneAttending'],
  ['Number_of_Children', 'numberOfChildren'],
  ['Child_1_Name', 'child1Name'],
  ['Child_1_Age', 'child1Age'],
  ['Child_2_Name', 'child2Name'],
  ['Child_2_Age', 'child2Age'],
  ['Child_3_Name', 'child3Name'],
  ['Child_3_Age', 'child3Age'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Address', 'address'],
  ['RSVP_Status', 'rsvpStatus'],
  ['Guest_Attending', 'guestAttending'],
  ['Plus_One_Attending', 'plusOneAttending'],
  ['Children_Attending', 'childrenAttending'],
  ['Total_in_Party', 'totalInParty'],
  ['Dietary_Restrictions', 'dietaryRestrictions'],
  ['Special_Accommodations', 'specialAccommodations'],
  ['Table_Number', 'tableNumber'],
  ['Table_Name', 'tableName'],
  ['Seating_Priority', 'seatingPriority'],
  ['Notes', 'notes'],
]);

function mapCsvRow(row) {
  const record = {};
  csvFieldMap.forEach((field, key) => {
    if (row[key] !== undefined) record[field] = row[key];
  });
  record.id = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  record.actuallyInvited = toBool(record.actuallyInvited);
  record.plusOneInvited = toBool(record.plusOneInvited);
  record.plusOneAttending = toBool(record.plusOneAttending);
  record.guestAttending = toBool(record.guestAttending);
  record.numberOfChildren = toNumber(record.numberOfChildren);
  record.childrenAttending = toNumber(record.childrenAttending);
  record.totalInParty = toNumber(record.totalInParty);
  record.child1Age = toNumberOrNull(record.child1Age);
  record.child2Age = toNumberOrNull(record.child2Age);
  record.child3Age = toNumberOrNull(record.child3Age);
  record.tableNumber = toNumber(record.tableNumber);
  record.inviteCategory = (record.inviteCategory || 'family').toLowerCase();
  record.seatingPriority = (record.seatingPriority || 'standard').toLowerCase();
  record.rsvpStatus = (record.rsvpStatus || 'none').toLowerCase();
  return record;
}

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
  return rows.filter(r => r.length).map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

// --- Utilities -------------------------------------------------------------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] || s));
}

function titleCase(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fallbackPartySize(row) {
  const base = (row.guestAttending ? 1 : 0) + (row.plusOneAttending ? 1 : 0) + (Number(row.childrenAttending) || 0);
  if (base > 0) return base;
  return 1 + (row.plusOneInvited ? 1 : 0) + (Number(row.numberOfChildren) || 0);
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  const str = String(value).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', '✓', 'checked', 'on'].includes(str);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toNumberOrNull(value) {
  if (value === '' || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

