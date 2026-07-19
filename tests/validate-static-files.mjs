import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const config = await readFile(new URL('firebase-config.js', root), 'utf8');
const core = await readFile(new URL('registry-core.js', root), 'utf8');

const requiredHtmlSnippets = [
  'id="bootView"',
  'id="accountMenu"',
  'id="accountTrigger"',
  'id="logoutButton"',
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
  'id="switchChoiceModal"',
  'id="goToCancelGiftButton"',
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

const coreScript = 'defer src="./registry-core.js"';
const appScript = 'defer src="./app.js"';

if (!html.includes(coreScript)) {
  throw new Error(`index.html missing ${coreScript}`);
}

if (html.indexOf(coreScript) > html.indexOf(appScript)) {
  throw new Error('registry-core.js must load before app.js');
}

for (const snippet of ['getReservationState', 'getOwnedGifts', 'giftRegistryCore']) {
  if (!core.includes(snippet)) {
    throw new Error(`registry-core.js missing ${snippet}`);
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
  "openSwitchChoiceModal",
  "switchConfirmedGift",
  "runTransaction",
  "pendingSwitch",
  "event.stopPropagation()",
  "pendingLogin",
  "pendingProfile",
  "toggleAccountMenu",
  "getInitials",
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

if (app.includes('Уже есть выбор')) {
  throw new Error('gift action must stay available and open the switch choice modal after a gift was selected');
}

if (html.includes('id="giftModal"') || app.includes('giftModal') || app.includes('openModal')) {
  throw new Error('product detail modal must be removed; cards should open marketplace links directly');
}

if (app.includes('babyGiftRegistry.profile') || app.includes('babyGiftRegistry.selection')) {
  throw new Error('app.js must only persist the phone number locally');
}

if (app.includes('gift.price') || app.includes('confirmGift.price')) {
  throw new Error('cards and confirmation modal must not render gift prices');
}

for (const forbiddenText of ['Малыш уже родился', 'Маркетплейс', 'Можно выбрать.']) {
  if (html.includes(forbiddenText) || app.includes(forbiddenText)) {
    throw new Error(`UI still contains forbidden text: ${forbiddenText}`);
  }
}

if (!config.includes('window.giftRegistryFirebase')) {
  throw new Error('firebase-config.js must expose window.giftRegistryFirebase');
}

console.log('Validated static app files');
