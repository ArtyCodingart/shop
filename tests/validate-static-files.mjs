import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const config = await readFile(new URL('firebase-config.js', root), 'utf8');

const requiredHtmlSnippets = [
  'id="loginForm"',
  'id="giftGrid"',
  'id="giftModal"',
  'id="reserveButton"',
  'type="module" src="./app.js"'
];

for (const snippet of requiredHtmlSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`index.html missing ${snippet}`);
  }
}

const requiredAppSnippets = [
  "babyGiftRegistry.profile",
  "babyGiftRegistry.selection",
  "fetch('./gifts.json'",
  "collection(state.firestore, 'reservations')",
  "window.confirm('Вы точно уверены"
];

for (const snippet of requiredAppSnippets) {
  if (!app.includes(snippet)) {
    throw new Error(`app.js missing ${snippet}`);
  }
}

if (!config.includes('isFirebaseConfigured')) {
  throw new Error('firebase-config.js must export isFirebaseConfigured');
}

console.log('Validated static app files');
