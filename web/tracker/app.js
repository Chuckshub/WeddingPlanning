// Invite Tracker — Admin dashboard (static demo mode)
// Firebase disabled for public preview; switches to in-memory data.

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const ui = {
  authView: $('#auth-view'),
  appView: $('#app-view'),
  googleBtn: $('#google-signin'),
  emailForm: $('#email-form'),
  userPanel: $('#user-panel'),
  userName: $('#user-name'),
  userPhoto: $('#user-photo'),
  signOut: $('#sign-out'),
  search: $('#search'),
  filterRsvp: $('#filter-rsvp'),
  filterSide: $('#filter-side'),
  addGuest: $('#add-guest'),
  csvFile: $('#csv-file'),
  exportBtn: $('#export'),
  tbody: $('#tbody'),
  empty: $('#empty'),
  guestModal: $('#guest-modal'),
  guestForm: $('#guest-form'),
  guestTitle: $('#guest-modal-title'),
};

const state = {
  auth: null,
  db: null,
  user: null,
  invites: [],
  filtered: [],
  editId: null,
};

// Static demo mode: no Firebase imports, no auth.
let db = null;
function subscribeInvites(){ /* no-op in demo */ }
function teardownInvites(){ /* no-op */ }

// UI rendering
function renderRows(list){
  ui.tbody.innerHTML = '';
  if (!list.length) { ui.empty.hidden = false; return; }
  ui.empty.hidden = true;
  const tpl = $('#row-template').content.firstElementChild;
  const frag = document.createDocumentFragment();
  for (const g of list){
    const row = tpl.cloneNode(true);
    row.dataset.id = g.id;
    row.querySelector('.name').textContent = g.name || '—';
    row.querySelector('.email').textContent = g.email || '—';
    row.querySelector('.side').textContent = g.side || '—';
    row.querySelector('.party').textContent = String(g.partySize ?? 1);
    row.querySelector('.tags').textContent = (g.tags||[]).join(', ');
    const sel = row.querySelector('.rsvp-select');
    sel.value = g.rsvpStatus || 'none';
    sel.addEventListener('change', () => updateRSVP(g.id, sel.value));
    row.querySelector('.edit').addEventListener('click', () => openGuestModal(g));
    row.querySelector('.delete').addEventListener('click', () => deleteGuest(g.id));
    frag.appendChild(row);
  }
  ui.tbody.appendChild(frag);
}

function applyFilters(){
  const term = ui.search.value.trim().toLowerCase();
  const fRsvp = ui.filterRsvp.value;
  const fSide = ui.filterSide.value;
  let out = [...state.invites];
  if (term) out = out.filter(g => [g.name, g.email, (g.tags||[]).join(' ')].join(' ').toLowerCase().includes(term));
  if (fRsvp !== 'all') out = out.filter(g => (g.rsvpStatus||'none') === fRsvp);
  if (fSide !== 'all') out = out.filter(g => (g.side||'') === fSide);
  state.filtered = out;
  renderRows(out);
}
ui.search?.addEventListener('input', applyFilters);
ui.filterRsvp?.addEventListener('change', applyFilters);
ui.filterSide?.addEventListener('change', applyFilters);

// Guest modal flow
ui.addGuest?.addEventListener('click', () => openGuestModal());
function openGuestModal(guest){
  state.editId = guest?.id ?? null;
  ui.guestTitle.textContent = guest ? 'Edit guest' : 'Add guest';
  ui.guestForm.name.value = guest?.name ?? '';
  ui.guestForm.email.value = guest?.email ?? '';
  ui.guestForm.side.value = guest?.side ?? 'bride';
  ui.guestForm.plusOnesAllowed.value = guest?.plusOnesAllowed ?? 0;
  ui.guestForm.tags.value = (guest?.tags||[]).join(', ');
  ui.guestForm.notes.value = guest?.notes ?? '';
  ui.guestModal.showModal();
}

ui.guestForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = new FormData(ui.guestForm);
  const payload = {
    id: state.editId || `local-${Date.now()}`,
    name: String(form.get('name')||'').trim(),
    email: String(form.get('email')||'').trim() || null,
    side: String(form.get('side')||'bride'),
    plusOnesAllowed: Number(form.get('plusOnesAllowed')||0),
    tags: String(form.get('tags')||'').split(',').map(s => s.trim()).filter(Boolean),
    notes: String(form.get('notes')||'').trim() || null,
    partySize: 1,
    rsvpStatus: 'none',
    updatedAt: Date.now(),
  };
  if (state.editId){
    const idx = state.invites.findIndex(g => g.id === state.editId);
    if (idx >= 0) state.invites[idx] = { ...state.invites[idx], ...payload };
  } else {
    state.invites.unshift(payload);
  }
  state.editId = null;
  ui.guestModal.close();
  ui.guestForm.reset();
  applyFilters();
});

function updateRSVP(id, value){
  const idx = state.invites.findIndex(g => g.id === id);
  if (idx >= 0){
    state.invites[idx] = { ...state.invites[idx], rsvpStatus: value, respondedAt: Date.now() };
    applyFilters();
  }
}

function deleteGuest(id){
  if (!confirm('Delete this guest?')) return;
  state.invites = state.invites.filter(g => g.id !== id);
  applyFilters();
}

// CSV import/export
ui.csvFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = csvParse(text);
  const mapped = rows.map(r => ({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    name: r.name || r.Name,
    email: r.email || r.Email || null,
    side: (r.side || r.Side || 'bride').toLowerCase(),
    plusOnesAllowed: Number(r.plusOnesAllowed || r["plus-ones"] || 0),
    tags: (r.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
    notes: r.notes || null,
    partySize: Number(r.partySize || 1),
    rsvpStatus: (r.rsvpStatus || 'none').toLowerCase(),
  }));
  state.invites = [...mapped, ...state.invites];
  applyFilters();
  e.target.value = '';
  alert('Import complete: ' + mapped.length + ' guests (demo mode).');
});

ui.exportBtn?.addEventListener('click', () => {
  const headers = ['name','email','side','plusOnesAllowed','partySize','rsvpStatus','tags','notes'];
  const lines = [headers.join(',')];
  for (const g of state.filtered){
    const row = [
      safe(g.name), safe(g.email||''), safe(g.side||''), g.plusOnesAllowed??0, g.partySize??1, safe(g.rsvpStatus||'none'), safe((g.tags||[]).join('; ')), safe(g.notes||'')
    ].join(',');
    lines.push(row);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'invites.csv' });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

function safe(s){ return '"' + String(s).replaceAll('"','""') + '"'; }
function csvParse(text){
  // Lightweight CSV parser (handles quotes)
  const rows = [];
  let i=0, field='', row=[], inQ=false;
  while(i < text.length){
    const c = text[i++];
    if (inQ){
      if (c==='"'){
        if (text[i]==='"'){ field+='"'; i++; }
        else inQ=false;
      } else field+=c;
    } else {
      if (c==='"') inQ=true;
      else if (c===','){ row.push(field); field=''; }
      else if (c==='\n' || c==='\r'){
        if (field || row.length){ row.push(field); rows.push(row); }
        if (text[i]==='\n') i++; // handle \r\n
        field=''; row=[];
      } else field+=c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  // header map
  const header = rows.shift().map(h => h.trim());
  return rows.map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

// Demo init
ui.authView.hidden = true;
ui.appView.hidden = false;
state.invites = [
  { id: 'demo-1', name: 'Taylor Swift', email: 'taylor@example.com', side: 'bride', partySize: 1, rsvpStatus: 'yes', tags:['music'] },
  { id: 'demo-2', name: 'Jordan Lee', email: 'jordan@example.com', side: 'groom', partySize: 2, rsvpStatus: 'none', tags:['family'] },
];
applyFilters();
