import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const config = await readFile(new URL('firebase-config.js', root), 'utf8');

const requiredHtmlSnippets = [
  'id="bootView"',
  'id="loginForm"',
  'id="selectedGiftSection"',
  'id="giftGrid"',
  'id="giftModal"',
  'id="confirmModal"',
  'id="confirmGiftButton"',
  'id="reserveButton"',
  'defer src="./firebase-config.js"',
  'defer src="./app.js"'
];

for (const snippet of requiredHtmlSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`index.html missing ${snippet}`);
  }
}

const requiredAppSnippets = [
  "babyGiftRegistry.profile",
  "babyGiftRegistry.selection",
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

if (!config.includes('window.giftRegistryFirebase')) {
  throw new Error('firebase-config.js must expose window.giftRegistryFirebase');
}

console.log('Validated static app files');
