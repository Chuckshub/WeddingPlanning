// Invite Tracker — Admin dashboard with Firebase Auth + Firestore
// Works after you create web/firebase-config.js and enable Auth + Firestore in Firebase Console

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

// Load Firebase if config is available
let firebaseConfig = null;
try {
  const mod = await import('../firebase-config.js');
  firebaseConfig = mod.firebaseConfig;
} catch(err) {
  console.warn('Missing firebase-config.js. Using demo mode (no backend).');
}

let app, auth, db, provider, firestore;
if (firebaseConfig) {
  const [{ initializeApp }, { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut: fbSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword }, { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }]
    = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js'),
    ]);

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  firestore = { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp };

  // Auth wiring
  ui.googleBtn?.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch(err) { alert(err.message); }
  });

  ui.emailForm?.addEventListener('submit', (e) => e.preventDefault());
  ui.emailForm?.querySelector('[data-action="signup"]').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = ui.emailForm.email.value.trim();
    const password = ui.emailForm.password.value.trim();
    try { await createUserWithEmailAndPassword(auth, email, password); } catch(err) { alert(err.message); }
  });
  ui.emailForm?.querySelector('[data-action="signin"]').addEventListener('click', async (e) => {
    const email = ui.emailForm.email.value.trim();
    const password = ui.emailForm.password.value.trim();
    try { await signInWithEmailAndPassword(auth, email, password); } catch(err) { alert(err.message); }
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    if (user) {
      ui.userPanel.hidden = false;
      ui.userName.textContent = user.displayName || user.email || 'Admin';
      if (user.photoURL) { ui.userPhoto.src = user.photoURL; ui.userPhoto.hidden = false; }
      else ui.userPhoto.hidden = true;
      ui.authView.hidden = true;
      ui.appView.hidden = false;
      subscribeInvites();
    } else {
      ui.userPanel.hidden = true;
      ui.appView.hidden = true;
      ui.authView.hidden = false;
      teardownInvites();
    }
  });

  ui.signOut?.addEventListener('click', () => fbSignOut(auth));
}

// Firestore invites subscription
let unsub = null;
function subscribeInvites(){
  if (!db) return; // demo mode skip
  const { collection, onSnapshot } = firestore;
  const ref = collection(db, 'invites');
  unsub = onSnapshot(ref, (snap) => {
    state.invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilters();
  });
}
function teardownInvites(){ if (unsub) { unsub(); unsub = null; } }

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

ui.guestForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(ui.guestForm);
  const payload = {
    name: form.get('name').trim(),
    email: String(form.get('email')||'').trim() || null,
    side: form.get('side') || 'bride',
    plusOnesAllowed: Number(form.get('plusOnesAllowed')||0),
    tags: String(form.get('tags')||'').split(',').map(s => s.trim()).filter(Boolean),
    notes: String(form.get('notes')||'').trim() || null,
    partySize: 1,
    rsvpStatus: 'none',
    updatedAt: Date.now(),
  };
  try {
    if (!db) throw new Error('No Firebase configured');
    const { addDoc, updateDoc, collection, doc, serverTimestamp } = firestore;
    if (state.editId){
      await updateDoc(doc(db, 'invites', state.editId), { ...payload, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'invites'), { ...payload, createdAt: serverTimestamp() });
    }
    ui.guestModal.close();
    ui.guestForm.reset();
  } catch(err) {
    alert('Failed to save guest: ' + err.message);
  }
});

async function updateRSVP(id, value){
  try {
    if (!db) throw new Error('No Firebase configured');
    const { updateDoc, doc, serverTimestamp } = firestore;
    await updateDoc(doc(db, 'invites', id), { rsvpStatus: value, respondedAt: value!=='none' ? serverTimestamp() : null });
  } catch(err) {
    alert('Failed to update RSVP: ' + err.message);
  }
}

async function deleteGuest(id){
  if (!confirm('Delete this guest?')) return;
  try {
    if (!db) throw new Error('No Firebase configured');
    const { deleteDoc, doc } = firestore;
    await deleteDoc(doc(db, 'invites', id));
  } catch(err) {
    alert('Failed to delete: ' + err.message);
  }
}

// CSV import/export
ui.csvFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = csvParse(text);
  const mapped = rows.map(r => ({
    name: r.name || r.Name,
    email: r.email || r.Email || null,
    side: (r.side || r.Side || 'bride').toLowerCase(),
    plusOnesAllowed: Number(r.plusOnesAllowed || r["plus-ones"] || 0),
    tags: (r.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
    notes: r.notes || null,
    partySize: Number(r.partySize || 1),
    rsvpStatus: (r.rsvpStatus || 'none').toLowerCase(),
  }));
  try {
    const { addDoc, collection, serverTimestamp } = firestore;
    for (const g of mapped) {
      await addDoc(collection(db, 'invites'), { ...g, createdAt: serverTimestamp() });
    }
    alert('Import complete: ' + mapped.length + ' guests.');
  } catch(err) {
    alert('Import failed: ' + err.message);
  } finally {
    e.target.value = '';
  }
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

// In demo mode (no Firebase), allow quick preview with dummy data
if (!firebaseConfig){
  state.invites = [
    { id: 'demo-1', name: 'Taylor Swift', email: 'taylor@example.com', side: 'bride', partySize: 1, rsvpStatus: 'yes', tags:['music'] },
    { id: 'demo-2', name: 'Jordan Lee', email: 'jordan@example.com', side: 'groom', partySize: 2, rsvpStatus: 'none', tags:['family'] },
  ];
  ui.authView.hidden = true; ui.appView.hidden = false;
  renderRows(state.invites);
}
