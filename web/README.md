# Modern Wedding Registry (Vanilla + Firebase placeholders)

A lightweight, single-page wedding registry with a modern look. Works offline with demo data, and can switch to Firebase/Firestore by adding a config file.

## Quick start

1) Open locally
- From this folder, just open `web/index.html` in a browser. You will see demo data.

2) Enable Firebase (optional)
- Copy `firebase-config.example.js` to `firebase-config.js` and fill in your project keys from Firebase Console.
- Ensure Firestore is enabled in your Firebase project.
- Recommended security rules (simplified, adjust as needed):

```js
// Firestore Rules (draft — tighten for production)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gifts/{giftId} {
      allow read: if true; // public can read gifts
      allow update, create: if request.time < timestamp.date(2026, 6, 15) && request.auth != null; // restrict in real app
    }
    match /pledges/{pledgeId} {
      allow create: if true; // or use reCAPTCHA + Cloud Functions in production
      allow read: if false;  // pledges are private
    }
    match /settings/{doc} {
      allow read: if true;
    }
  }
}
```

## Firestore data model (suggested)

- settings (doc: `site`)
  - coupleNames: string
  - date: string or timestamp
  - venue: string
  - story: string
  - signature: string
- gifts (collection)
  - title: string
  - description: string
  - category: 'home'|'kitchen'|'experience'|'honeymoon'|'charity'
  - imageUrl: string
  - allowPartial: boolean
  - price: number (single-purchase)
  - goalAmount: number (group gift)
  - amountFunded: number
  - rank: number
- pledges (collection)
  - giftId: string (reference to gifts)
  - amount: number
  - name?: string
  - message?: string
  - createdAt: timestamp

## Seeding idea (optional)

You can quickly populate gifts from the browser console if Firebase is enabled:

```js
// In the console on index.html
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const seed = [
  { title:'Honeymoon Flights to Maui', description:'Help us get to paradise.', category:'honeymoon', allowPartial:true, goalAmount:2000, amountFunded:0, rank:10 },
  { title:'Stand Mixer', description:'For endless cookies and weekend pasta.', category:'kitchen', price:349, allowPartial:false, amountFunded:0, rank:8 },
];
for (const g of seed) await addDoc(collection(db,'gifts'), g);
```

## Notes
- Payment processing is intentionally excluded; the "Confirm Pledge" creates a `pledges` doc and increments `gifts.amountFunded`.
- Styling uses modern CSS only.
- You can host this folder on any static host (Firebase Hosting, GitHub Pages, etc.).


---

## Invite Tracker (admin) — setup

Location: `web/tracker/`

What it does
- Secure admin dashboard to manage invites stored in Firestore.
- Firebase Authentication (Google + Email/Password) gating.
- Live list with search/filters, add/edit, RSVP status updates, CSV import/export.

Steps
1) Ensure `web/firebase-config.js` exists and points to your Firebase project.
2) In Firebase Console:
   - Enable Authentication providers: Google, Email/Password.
   - Create Firestore database.
3) Firestore rules (draft — limit to admins only). This variant uses an `admins` collection with documents named by admin UID:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /invites/{id} {
      allow read, write: if request.auth != null && isAdmin();
    }

    match /admins/{uid} {
      // bootstrap: allow a specific email to create their own admin doc once
      allow create: if request.auth != null && request.auth.token.email.matches(".*@example.com$");
      allow read: if request.auth != null && isAdmin();
      allow write: if false; // tighten as desired
    }
  }
}
```

- To bootstrap, manually add your UID as a doc ID in `admins` collection via Firebase Console.
- Replace the email regex above with your email domain or remove that block once bootstrapped.

CSV format
- Headers accepted: `name,email,side,plusOnesAllowed,partySize,rsvpStatus,tags,notes`
- Tags may be comma- or semicolon-separated; importer handles both.

Notes
- This is an admin-only tool; guest RSVP portal is not included here. We can add `/web/rsvp/` next using invite codes.
