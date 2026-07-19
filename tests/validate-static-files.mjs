import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const styles = await readFile(new URL('styles.css', root), 'utf8');
const config = await readFile(new URL('firebase-config.js', root), 'utf8');
const core = await readFile(new URL('registry-core.js', root), 'utf8');

for (const forbiddenSnippet of [
  'switchChoiceModal',
  'switchGift',
  'pendingSwitch',
  'openSwitchChoiceModal',
  'switchConfirmedGift',
  'getConfirmedSelectedGift',
  'syncSelectedGift'
]) {
  if (html.includes(forbiddenSnippet) || app.includes(forbiddenSnippet)) {
    throw new Error(`single-selection flow still contains ${forbiddenSnippet}`);
  }
}

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
  'class="selected-gifts hidden"',
  'id="selectedGiftSection"',
  'id="selectedGiftTitle"',
  'id="selectedGiftGrid"',
  'Ваши подарки',
  'Вы планируете купить эти подарки. Нажмите на карточку, чтобы перейти в магазин.',
  'id="giftListTitle" tabindex="-1"',
  'id="giftGrid"',
  'Выберите подарки, которые хотите купить. Свободная карточка сначала покажет подтверждение.',
  'id="confirmModal"',
  'Выбор подарка',
  'id="confirmTitle"',
  'id="confirmText"',
  'id="confirmPreview"',
  'id="cancelConfirmButton"',
  '<button class="ghost-button" id="cancelConfirmButton" type="button">Нет</button>',
  'id="confirmGiftButton"',
  'Хотите купить этот подарок?',
  '<button class="primary-action" id="confirmGiftButton" type="button">Да</button>',
  'id="handoffModal"',
  'Перед переходом',
  'id="handoffTitle"',
  'id="handoffPreview"',
  'id="handoffStatus"',
  'id="handoffBackButton"',
  'id="handoffConfirmButton"',
  'Как это работает',
  'После подтверждения мы закрепим подарок за вами и автоматически откроем магазин.',
  'В магазине нужно самостоятельно оформить и оплатить покупку. Если подарок уже заняли, переход не произойдёт.',
  '<button class="ghost-button" id="handoffBackButton" type="button">Назад</button>',
  '<button class="primary-action" id="handoffConfirmButton" type="button">Понятно, перейти</button>',
  'id="cancelSelectionModal"',
  'id="cancelSelectionDialog" tabindex="-1"',
  'id="cancelSelectionText"',
  'id="confirmCancelGiftButton"'
];

for (const snippet of requiredHtmlSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`index.html missing ${snippet}`);
  }
}

const confirmModalIndex = html.indexOf('id="confirmModal"');
const handoffModalIndex = html.indexOf('id="handoffModal"');
const cancelSelectionModalIndex = html.indexOf('id="cancelSelectionModal"');
const cancelSelectionDialogIndex = html.indexOf('id="cancelSelectionDialog"');

if (confirmModalIndex >= handoffModalIndex) {
  throw new Error('handoffModal must follow confirmModal');
}

if (cancelSelectionDialogIndex <= cancelSelectionModalIndex) {
  throw new Error('cancelSelectionDialog must be inside cancelSelectionModal');
}

const scriptSources = Array.from(
  html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
  (match) => match[1]
);
const coreScript = './registry-core.js';
const appScript = './app.js';

for (const scriptSource of ['./firebase-config.js', coreScript, appScript]) {
  if (!scriptSources.includes(scriptSource)) {
    throw new Error(`index.html missing script source ${scriptSource}`);
  }
}

if (scriptSources.indexOf(coreScript) > scriptSources.indexOf(appScript)) {
  throw new Error('registry-core.js must load before app.js');
}

for (const snippet of ['deleteOwnedReservation', 'transaction.delete(reservationRef)', 'getReservationState', 'getOwnedGifts', 'giftRegistryCore']) {
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
  "openMarketLink",
  "window.giftRegistryCore",
  "getOwnedGifts",
  "getReservationState",
  "renderSelectedGifts",
  "createGiftCard",
  "gift-card-main",
  "description.className = 'gift-description'",
  "status.textContent = availabilityText",
  "mainControl.setAttribute('aria-labelledby'",
  "mainControl.setAttribute('aria-describedby'",
  "card.append(image, body, mainControl, action)",
  "getGiftDomToken",
  "mainControl.addEventListener('click'",
  "action.addEventListener('click'",
  "state.cancelGift",
  "state.cancelGiftId",
  "openCancelSelectionModal(gift",
  "finishCancelSelection",
  "trapCancelSelectionFocus",
  "restoreCancelSelectionFocus",
  "cancelSelectionDialog",
  "setAttribute('aria-busy', 'true')",
  "removeAttribute('aria-busy')",
  "cancelSelectionDialog.focus()",
  "deleteOwnedReservation",
  "runTransaction",
  "pendingLogin",
  "pendingProfile",
  "toggleAccountMenu",
  "getInitials",
  "selectedGiftId",
  'reservationsLoaded',
  'renderSkeletonCards',
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
  throw new Error('gift action must stay available for additional selections');
}

for (const forbiddenCardHandler of ["card.addEventListener('click'", "card.addEventListener('keydown'", "card.setAttribute('role'", 'card.tabIndex']) {
  if (app.includes(forbiddenCardHandler)) {
    throw new Error(`gift cards must use sibling native controls; found ${forbiddenCardHandler}`);
  }
}

if (app.includes('<p class="gift-status">${')) {
  throw new Error('reservation status must be assigned with textContent, not interpolated into markup');
}

if (app.includes('mainControl.append(image, body)')) {
  throw new Error('gift-card-main must remain an empty overlay control');
}

for (const styleSnippet of [
  '.selected-gifts',
  '.selected-gift-grid',
  '.gift-card-main',
  '.unavailable-gift',
  ':not(.unavailable-gift)',
  'grid-template-rows: 168px 1fr auto',
  'position: absolute',
  'inset: 0',
  'z-index: 2',
  'flex-direction: column',
  'margin-top: auto'
]) {
  if (!styles.includes(styleSnippet)) {
    throw new Error(`styles.css missing ${styleSnippet}`);
  }
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
