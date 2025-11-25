// app.js — modern wedding registry with Firebase placeholders
// This file runs in the browser. It is framework-free (vanilla JS) and progressive:
// - Works with built-in demo data out of the box
// - If web/firebase-config.js exists and Firebase SDK is reachable, switches to Firestore

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ui = {
  grid: $('#gift-grid'),
  empty: $('#empty-state'),
  search: $('#search'),
  filter: $('#filter'),
  sort: $('#sort'),
  modal: $('#contribute-modal'),
  form: $('#contribute-form'),
  confirm: $('#confirm-contribute'),
};

const state = {
  gifts: [],
  filtered: [],
  selectedGift: null,
  firebase: { app: null, db: null, enabled: false },
};

// Static demo mode: Firebase disabled to allow immediate deploy on Vercel/Netlify/etc.
// To re-enable later, restore the firebase-config import and SDK setup.
state.firebase.enabled = false;

// Render a single gift card from data
function renderGiftCard(gift) {
  const tpl = document.getElementById('gift-card-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.giftId = gift.id;

  const media = node.querySelector('.media');
  if (gift.imageUrl) media.style.background = `center/cover no-repeat url(${gift.imageUrl})`;

  node.querySelector('.title').textContent = gift.title;
  node.querySelector('.desc').textContent = gift.description;
  node.querySelector('.category').textContent = gift.categoryLabel ?? gift.category ?? 'Gift';

  const priceEl = node.querySelector('.price');
  priceEl.textContent = gift.allowPartial ? `$${gift.goalAmount.toLocaleString()}` : `$${gift.price?.toLocaleString?.() ?? '—'}`;

  // Progress
  const funded = Number(gift.amountFunded || 0);
  const goal = Number(gift.allowPartial ? gift.goalAmount : gift.price || 0) || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((funded / goal) * 100)) : 0;
  node.querySelector('.fill').style.width = pct + '%';
  node.querySelector('.progress-text').textContent = goal ? `${pct}% funded` : '—';

  // Actions
  node.querySelector('.contribute').addEventListener('click', () => openContribute(gift));
  node.querySelector('.details').addEventListener('click', () => showDetails(gift));

  return node;
}

function renderGrid(list) {
  ui.grid.innerHTML = '';
  if (!list.length) {
    ui.empty.classList.remove('hidden');
    return;
  }
  ui.empty.classList.add('hidden');
  const frag = document.createDocumentFragment();
  list.forEach(g => frag.appendChild(renderGiftCard(g)));
  ui.grid.appendChild(frag);
}

function applyFilters() {
  const term = ui.search.value.trim().toLowerCase();
  const cat = ui.filter.value;
  let out = [...state.gifts];
  if (cat !== 'all') out = out.filter(g => (g.category || '').toLowerCase() === cat);
  if (term) out = out.filter(g => [g.title, g.description].join(' ').toLowerCase().includes(term));
  state.filtered = out;
  renderGrid(out);
}

ui.search?.addEventListener('input', applyFilters);
ui.filter?.addEventListener('change', applyFilters);
ui.sort?.addEventListener('click', () => {
  state.filtered.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  renderGrid(state.filtered);
});

// Details: simple alert placeholder
function showDetails(gift){
  alert(`${gift.title}\n\n${gift.description}`);
}

// Contribute flow (writes to Firestore if enabled; otherwise logs)
function openContribute(gift) {
  state.selectedGift = gift;
  $('#modal-title').textContent = `Contribute to ${gift.title}`;
  $('.gift-title', ui.modal).textContent = gift.title;
  $('.gift-sub', ui.modal).textContent = gift.categoryLabel ?? gift.category ?? '';
  ui.modal.showModal();
}

ui.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.selectedGift) return ui.modal.close();

  const data = Object.fromEntries(new FormData(ui.form).entries());
  const amount = Math.max(1, Number(data.amount || 0));

  if (!state.firebase.enabled) {
    console.log('[Demo] Pledge created', { giftId: state.selectedGift.id, amount, name: data.name || null, message: data.message || null });
    ui.modal.close();
    ui.form.reset();
    return;
  }

  try {
    const { db, addDoc, collection, doc, runTransaction, serverTimestamp } = state.firebase;

    // 1) Add a pledge document
    await addDoc(collection(db, 'pledges'), {
      giftId: state.selectedGift.id,
      amount,
      name: data.name || null,
      message: data.message || null,
      createdAt: serverTimestamp(),
    });

    // 2) Atomically increment amountFunded on the gift
    const giftRef = doc(db, 'gifts', state.selectedGift.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(giftRef);
      if (!snap.exists()) return;
      const current = Number(snap.data().amountFunded || 0);
      tx.update(giftRef, { amountFunded: current + amount });
    });

    ui.modal.close();
    ui.form.reset();
  } catch (err) {
    console.error('Failed to create pledge', err);
    alert('Sorry, something went wrong. Please try again.');
  }
});

// Data loading
async function loadData() {
  if (state.firebase.enabled) {
    const { db, collection, onSnapshot } = state.firebase;
    // Live subscription to gifts collection
    onSnapshot(collection(db, 'gifts'), (snap) => {
      state.gifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilters();
    });
    return;
  }

  // Demo data fallback
  const demo = await import('./demo-data.js');
  state.gifts = demo.gifts.map((g, i) => ({ id: g.id || `demo-${i+1}`, ...g }));
  applyFilters();
}

// Suggested Firestore structure (for reference):
// collections:
// - settings (doc: 'site')
//   fields: { coupleNames: string, date: timestamp/string, venue: string, story: string, signature: string }
// - gifts (documents)
//   fields: {
//      title: string,
//      description: string,
//      category: 'home'|'kitchen'|'experience'|'honeymoon'|'charity',
//      imageUrl: string,
//      price: number,            // for single-purchase items
//      allowPartial: boolean,    // true for group gifts
//      goalAmount: number,       // for group gifts
//      amountFunded: number,     // sum of pledges
//      rank: number              // for sorting/prominence
//   }
// - pledges (append-only)
//   fields: { giftId: ref/id, amount: number, name?: string, message?: string, createdAt: timestamp }

await loadData();
