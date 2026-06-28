import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const config = await readFile(new URL('firebase-config.js', root), 'utf8');

const requiredHtmlSnippets = [
  'id="bootView"',
  'id="loginForm"',
  'id="phoneNumber"',
  'id="loginButton"',
  'id="registerView"',
  'id="registerForm"',
  'id="registerButton"',
  'id="selectedGiftSection"',
  'id="giftGrid"',
  'id="confirmModal"',
  'id="confirmGiftButton"',
  'id="cancelSelectionModal"',
  'id="confirmCancelGiftButton"',
  'defer src="./firebase-config.js"',
  'defer src="./app.js"'
];

for (const snippet of requiredHtmlSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`index.html missing ${snippet}`);
  }
}

const requiredAppSnippets = [
  "babyGiftRegistry.phone",
  "users",
  "normalizePhone",
  "loadUserByPhone",
  "createUserProfile",
  "deleteDoc",
  "openMarketLink",
  "event.stopPropagation()",
  "pendingLogin",
  "pendingProfile",
  'id="cancelGiftButton"',
  "selectedGiftId",
  'reservationsLoaded',
  'renderSkeletonCards',
  'renderSelectedGift',
  "fetch('./gifts.json'",
  "collection(state.firestore, 'reservations')",
  "location.protocol === 'file:'"
];

for (const snippet of requiredAppSnippets) {
  if (!app.includes(snippet)) {
    throw new Error(`app.js missing ${snippet}`);
  }
}

if (app.includes("import { firebaseConfig, isFirebaseConfigured }")) {
  throw new Error('app.js must not use a static module import for local file previews');
}

if (app.includes('window.confirm')) {
  throw new Error('app.js must use the custom confirmation modal instead of window.confirm');
}

if (html.includes('id="giftModal"') || app.includes('giftModal') || app.includes('openModal')) {
  throw new Error('product detail modal must be removed; cards should open marketplace links directly');
}

if (app.includes('babyGiftRegistry.profile') || app.includes('babyGiftRegistry.selection')) {
  throw new Error('app.js must only persist the phone number locally');
}

if (!config.includes('window.giftRegistryFirebase')) {
  throw new Error('firebase-config.js must expose window.giftRegistryFirebase');
}

console.log('Validated static app files');
