# Multi-Gift Selection And Marketplace Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one phone-based guest reserve multiple gifts, cancel each reservation independently, and navigate to the marketplace only after the final explanatory confirmation successfully creates a reservation.

**Architecture:** Keep `reservations/{giftId}` as the sole source of selection truth and derive a guest's owned gifts by phone. Add a tiny browser/CommonJS-compatible pure module for ownership classification, then reuse one card renderer for the selected section and full catalog. Use Firestore transactions for both final reservation and individual cancellation, with the two-dialog handoff and delayed same-tab navigation managed in `app.js`.

**Tech Stack:** Static HTML/CSS/JavaScript, Firebase Firestore browser SDK 10.12.4, Node.js built-in test runner and existing source validators.

---

## File Map

- Create `registry-core.js`: pure ownership helpers shared by the browser app and Node tests.
- Create `tests/registry-core.test.cjs`: behavioral unit tests for free, own, reserved, and multiple-owned states.
- Modify `index.html`: selected-gift grid, simplified first dialog, explanatory handoff dialog, and script ordering.
- Modify `app.js`: shared card renderer, derived multi-selection state, per-gift cancellation, transactional reservation, error handling, focus restoration, and same-tab handoff.
- Modify `styles.css`: compact selected grid, shared equal-height cards, bottom-aligned actions, and handoff status styling.
- Modify `tests/validate-static-files.mjs`: DOM/source/CSS contract for the new flow and removal of single-selection switching.
- Modify `README.md`: multiple-selection behavior, reservation source of truth, and complete verification commands.

`firestore.rules` does not change. Existing create/delete permissions already permit the reservation transactions, and the trusted-friends security limitation remains documented.

### Task 1: Add A Testable Reservation Ownership Core

**Files:**
- Create: `registry-core.js`
- Create: `tests/registry-core.test.cjs`
- Modify: `index.html:126-127`
- Modify: `tests/validate-static-files.mjs:4-30`

- [ ] **Step 1: Write failing unit and script-order tests**

Create `tests/registry-core.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getOwnedGifts, getReservationState } = require('../registry-core.js');

test('classifies free, own, and reserved gifts', () => {
  assert.equal(getReservationState(undefined, '77000000000'), 'free');
  assert.equal(getReservationState({ phone: '77000000000' }, '77000000000'), 'own');
  assert.equal(getReservationState({ phone: '78000000000' }, '77000000000'), 'reserved');
});

test('returns every gift reserved by the current phone in catalog order', () => {
  const gifts = [{ id: 'monitor' }, { id: 'bath' }, { id: 'carrier' }];
  const reservations = new Map([
    ['monitor', { phone: '77000000000' }],
    ['bath', { phone: '78000000000' }],
    ['carrier', { phone: '77000000000' }]
  ]);

  assert.deepEqual(getOwnedGifts(gifts, reservations, '77000000000'), [gifts[0], gifts[2]]);
});

test('returns no owned gifts without a loaded phone', () => {
  const gifts = [{ id: 'monitor' }];
  const reservations = new Map([['monitor', { phone: '77000000000' }]]);

  assert.deepEqual(getOwnedGifts(gifts, reservations, ''), []);
});
```

In `tests/validate-static-files.mjs`, add `registry-core.js` to the files read at the top and add these assertions after the HTML snippet loop:

```js
const core = await readFile(new URL('registry-core.js', root), 'utf8');
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
```

- [ ] **Step 2: Run the tests and verify the expected failures**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-static-files.mjs
```

Expected: the unit test fails with `Cannot find module '../registry-core.js'`, and the validator fails because `registry-core.js` is missing.

- [ ] **Step 3: Implement the pure core**

Create `registry-core.js`:

```js
(function attachGiftRegistryCore(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.giftRegistryCore = api;
})(typeof globalThis === 'object' ? globalThis : window, () => {
  function getReservationState(reservation, phone) {
    if (!reservation) {
      return 'free';
    }

    return reservation.phone === phone ? 'own' : 'reserved';
  }

  function getOwnedGifts(gifts, reservations, phone) {
    if (!phone) {
      return [];
    }

    return gifts.filter((gift) => getReservationState(reservations.get(gift.id), phone) === 'own');
  }

  return Object.freeze({
    getOwnedGifts,
    getReservationState
  });
});
```

Load it between the Firebase config and app scripts in `index.html`:

```html
<script defer src="./firebase-config.js"></script>
<script defer src="./registry-core.js"></script>
<script defer src="./app.js"></script>
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-static-files.mjs
```

Expected: three unit tests pass and the static validator prints `Validated static app files`.

- [ ] **Step 5: Commit the ownership core**

```bash
git add registry-core.js index.html tests/registry-core.test.cjs tests/validate-static-files.mjs
git commit -m "test: add multi-gift ownership core"
```

### Task 2: Add The Selected Grid And Two-Dialog DOM Shell

**Files:**
- Modify: `index.html:73-127`
- Modify: `tests/validate-static-files.mjs:9-36`

- [ ] **Step 1: Extend the HTML contract with failing assertions**

Replace the selection/modal portion of `requiredHtmlSnippets` with:

```js
'id="selectedGiftSection"',
'id="selectedGiftGrid"',
'Ваши подарки',
'id="giftGrid"',
'id="confirmModal"',
'id="confirmGiftButton"',
'Хотите купить этот подарок?',
'id="handoffModal"',
'id="handoffPreview"',
'id="handoffStatus"',
'id="handoffBackButton"',
'id="handoffConfirmButton"',
'Как это работает',
'id="cancelSelectionModal"',
'id="cancelSelectionText"',
'id="confirmCancelGiftButton"'
```

Add a temporary guard that the explanatory modal exists after the first modal:

```js
if (html.indexOf('id="handoffModal"') < html.indexOf('id="confirmModal"')) {
  throw new Error('handoffModal must follow confirmModal');
}
```

- [ ] **Step 2: Run the validator and verify it fails**

Run: `node tests/validate-static-files.mjs`

Expected: FAIL with `index.html missing id="selectedGiftGrid"`.

- [ ] **Step 3: Replace the selected section and catalog copy**

Replace `index.html:75-80` with:

```html
<section class="selected-gifts hidden" id="selectedGiftSection" aria-labelledby="selectedGiftTitle">
  <div class="section-heading selected-gifts-heading">
    <h2 id="selectedGiftTitle">Ваши подарки</h2>
    <p class="section-copy">Вы планируете купить эти подарки. Нажмите на карточку, чтобы перейти в магазин.</p>
  </div>
  <div class="gift-grid selected-gift-grid" id="selectedGiftGrid" aria-live="polite"></div>
</section>
<div class="section-heading">
  <h2 id="giftListTitle">Все подарки</h2>
  <p class="section-copy">Выберите подарки, которые хотите купить. Свободная карточка сначала покажет подтверждение.</p>
</div>
<div class="gift-grid" id="giftGrid" aria-live="polite"></div>
```

- [ ] **Step 4: Simplify the first dialog and add the explanatory dialog**

Replace the first dialog and insert the handoff dialog immediately after it:

```html
<div class="modal-backdrop hidden" id="confirmModal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
  <article class="confirm-dialog">
    <p class="eyebrow">Выбор подарка</p>
    <h2 id="confirmTitle">Хотите купить этот подарок?</h2>
    <p id="confirmText"></p>
    <div class="confirm-preview" id="confirmPreview"></div>
    <div class="confirm-actions">
      <button class="ghost-button" id="cancelConfirmButton" type="button">Нет</button>
      <button class="primary-action" id="confirmGiftButton" type="button">Да</button>
    </div>
  </article>
</div>

<div class="modal-backdrop hidden" id="handoffModal" role="dialog" aria-modal="true" aria-labelledby="handoffTitle">
  <article class="confirm-dialog">
    <p class="eyebrow">Перед переходом</p>
    <h2 id="handoffTitle">Как это работает</h2>
    <p>После подтверждения мы закрепим подарок за вами и автоматически откроем магазин.</p>
    <p>В магазине нужно самостоятельно оформить и оплатить покупку. Если подарок уже заняли, переход не произойдёт.</p>
    <div class="confirm-preview" id="handoffPreview"></div>
    <p class="handoff-status hidden" id="handoffStatus" role="status"></p>
    <div class="confirm-actions">
      <button class="ghost-button" id="handoffBackButton" type="button">Назад</button>
      <button class="primary-action" id="handoffConfirmButton" type="button">Понятно, перейти</button>
    </div>
  </article>
</div>
```

Keep the existing switch modal until Task 3 so the current app remains runnable between commits.

- [ ] **Step 5: Run validators and verify the DOM shell passes**

Run:

```bash
node tests/validate-static-files.mjs
node tests/validate-gifts.mjs
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the DOM shell**

```bash
git add index.html tests/validate-static-files.mjs
git commit -m "feat: add multi-gift dialog shell"
```

### Task 3: Render Multiple Owned Gifts And Cancel One Transactionally

**Files:**
- Modify: `app.js:1-782`
- Modify: `index.html:97-110`
- Modify: `styles.css:318-498,714-760`
- Modify: `tests/validate-static-files.mjs:4-105`

- [ ] **Step 1: Write the failing multi-selection and cancellation contract**

Read `styles.css` in `tests/validate-static-files.mjs`:

```js
const styles = await readFile(new URL('styles.css', root), 'utf8');
```

Replace switch/single-selection requirements in `requiredAppSnippets` with:

```js
"window.giftRegistryCore",
"getOwnedGifts",
"getReservationState",
"renderSelectedGifts",
"createGiftCard",
"state.cancelGift",
"openCancelSelectionModal(gift",
"runTransaction",
"transaction.delete(reservationRef)",
"event.stopPropagation()"
```

Remove the obsolete required entries `"deleteDoc"`, `"openSwitchChoiceModal"`, `"switchConfirmedGift"`, `"pendingSwitch"`, `'id="cancelGiftButton"'`, and `"renderSelectedGift"`; the new snippets above replace them.

Add these forbidden-flow and layout assertions:

```js
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

for (const styleSnippet of [
  '.selected-gifts',
  '.selected-gift-grid',
  'flex-direction: column',
  'margin-top: auto'
]) {
  if (!styles.includes(styleSnippet)) {
    throw new Error(`styles.css missing ${styleSnippet}`);
  }
}
```

- [ ] **Step 2: Run the validator and verify it fails on the old switch flow**

Run: `node tests/validate-static-files.mjs`

Expected: FAIL with `single-selection flow still contains switchChoiceModal`.

- [ ] **Step 3: Remove the switch modal from HTML and install derived state**

Delete the entire `switchChoiceModal` block from `index.html`.

At the top of `app.js`, add:

```js
const { getOwnedGifts, getReservationState } = window.giftRegistryCore;
const GIFT_NOT_OWNED = 'gift-not-owned';
```

Keep `confirmGift` and `pendingReservation` temporarily for the still-working first dialog, remove `switchGift` and `pendingSwitch`, and install cancellation state so the relevant state block is:

```js
confirmGift: null,
cancelGift: null,
cancelTrigger: null,
pendingReservation: false,
pendingCancel: false,
```

Add `selectedGiftGrid` and `cancelSelectionText` to `elements`, and remove all switch-modal elements. Remove `selectedGiftId` from `normalizeUser`; retain only `selectedGiftId: ''` in new-profile creation for deployed-rule compatibility. Remove both calls to `syncSelectedGift` and delete that function.

Delete the switch-modal click handlers from `bindEvents`, remove `closeSwitchChoiceModal()` from the `Escape` handler and `clearProfile`, and delete `openSwitchChoiceModal`, `closeSwitchChoiceModal`, and `switchConfirmedGift` in full. Keep the existing confirm and cancellation bindings until their replacements below are installed.

- [ ] **Step 4: Replace single-selection rendering with the shared card renderer**

Use these functions in place of `renderSelectedGift`, the old `renderGifts` loop, and the old action helpers:

```js
function renderSelectedGifts() {
  elements.selectedGiftGrid.replaceChildren();

  if (!state.profile || !state.reservationsLoaded || state.reservationsFailed) {
    elements.selectedGiftSection.classList.add('hidden');
    return;
  }

  const ownedGifts = getOwnedGifts(state.gifts, state.reservations, state.profile.phone);
  elements.selectedGiftSection.classList.toggle('hidden', ownedGifts.length === 0);

  for (const gift of ownedGifts) {
    elements.selectedGiftGrid.append(createGiftCard(gift, 'selected'));
  }
}

function renderGifts() {
  elements.giftGrid.replaceChildren();

  if (shouldShowSkeleton()) {
    renderSkeletonCards();
    return;
  }

  if (state.gifts.length === 0) {
    elements.giftGrid.innerHTML = '<p class="status-banner">Пока список подарков пуст.</p>';
    return;
  }

  for (const gift of state.gifts) {
    elements.giftGrid.append(createGiftCard(gift, 'catalog'));
  }
}

function createGiftCard(gift, context) {
  const reservation = state.reservations.get(gift.id);
  const reservationState = getReservationState(reservation, state.profile?.phone);
  const isSelectedCard = context === 'selected';
  const isUnavailable = !state.firebaseReady || state.reservationsFailed || reservationState === 'reserved';
  const card = document.createElement('article');
  const cardAction = isSelectedCard || reservationState === 'own' ? 'market' : 'select';

  card.className = `gift-card${reservationState !== 'free' ? ' reserved' : ''}${reservationState === 'own' ? ' own-gift' : ''}${isSelectedCard ? ' selected-gift-card' : ''}`;
  card.tabIndex = isUnavailable && reservationState !== 'own' ? -1 : 0;
  card.setAttribute('role', isUnavailable && reservationState !== 'own' ? 'group' : cardAction === 'market' ? 'link' : 'button');
  card.setAttribute('aria-label', getCardAriaLabel(gift, reservationState, isUnavailable));
  card.innerHTML = `
    <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}" loading="lazy">
    <div class="gift-body">
      <div class="gift-topline"><span>${escapeHtml(gift.category)}</span></div>
      <h2>${escapeHtml(gift.title)}</h2>
      <p>${escapeHtml(gift.description)}</p>
      ${getAvailabilityText(reservationState, reservation, isSelectedCard) ? `<p class="gift-status">${getAvailabilityText(reservationState, reservation, isSelectedCard)}</p>` : ''}
      <button class="gift-action${isSelectedCard ? ' cancel-gift-action' : ''}" type="button" ${isUnavailable && !isSelectedCard && reservationState !== 'own' ? 'disabled' : ''}>
        ${getActionText(reservationState, isSelectedCard)}
      </button>
    </div>
  `;

  const button = card.querySelector('button');
  const activateCard = () => {
    if (isSelectedCard || reservationState === 'own') {
      openMarketLink(gift);
    } else if (!isUnavailable) {
      openConfirmModal(gift, card);
    }
  };

  card.addEventListener('click', activateCard);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateCard();
    }
  });
  button.addEventListener('click', (event) => {
    event.stopPropagation();

    if (isSelectedCard) {
      openCancelSelectionModal(gift, button);
    } else {
      activateCard();
    }
  });

  return card;
}

function getAvailabilityText(reservationState, reservation, isSelectedCard) {
  if (reservationState === 'own' && isSelectedCard) return 'Вы покупаете этот подарок.';
  if (reservationState === 'own') return 'Этот подарок покупаете вы.';
  if (reservationState === 'reserved') return `Уже покупает ${reservation.displayName}.`;
  if (!state.firebaseReady || state.reservationsFailed) return 'Покупка временно недоступна.';
  return '';
}

function getActionText(reservationState, isSelectedCard) {
  if (isSelectedCard) return 'Отказаться';
  if (reservationState === 'own') return 'Перейти в магазин';
  if (reservationState === 'reserved') return 'Уже купят';
  if (!state.firebaseReady || state.reservationsFailed) return 'Загрузка статуса';
  return 'Я хочу купить';
}

function getCardAriaLabel(gift, reservationState, isUnavailable) {
  if (reservationState === 'own') return `Открыть магазин: ${gift.title}`;
  if (isUnavailable) return `Подарок недоступен: ${gift.title}`;
  return `Выбрать подарок: ${gift.title}`;
}
```

Call `renderSelectedGifts()` everywhere the old code called `renderSelectedGift()`. Keep all gifts in `renderGifts()` so own gifts remain visible in the full catalog.

- [ ] **Step 5: Make cancellation target one reservation transactionally**

Replace the cancellation functions with:

```js
function openCancelSelectionModal(gift, trigger) {
  if (!gift || getReservationState(state.reservations.get(gift.id), state.profile?.phone) !== 'own') {
    return;
  }

  state.cancelGift = gift;
  state.cancelTrigger = trigger;
  elements.cancelSelectionText.textContent = `Подарок «${gift.title}» снова станет доступен другим гостям. Остальные ваши подарки сохранятся.`;
  elements.cancelSelectionModal.classList.remove('hidden');
}

function closeCancelSelectionModal() {
  if (state.pendingCancel) return;

  elements.cancelSelectionModal.classList.add('hidden');
  const trigger = state.cancelTrigger;
  state.cancelGift = null;
  state.cancelTrigger = null;
  if (trigger?.isConnected) trigger.focus();
}

async function cancelSelectedGift() {
  const gift = state.cancelGift;
  if (!gift || !state.profile || !state.firestore) return;

  const { doc, runTransaction } = state.firebaseApi;
  const reservationRef = doc(state.firestore, 'reservations', gift.id);

  try {
    state.pendingCancel = true;
    elements.keepGiftButton.disabled = true;
    elements.confirmCancelGiftButton.disabled = true;
    elements.confirmCancelGiftButton.textContent = 'Отказываемся…';

    await runTransaction(state.firestore, async (transaction) => {
      const snapshot = await transaction.get(reservationRef);
      if (!snapshot.exists() || snapshot.data().phone !== state.profile.phone) {
        const error = new Error('Gift is not reserved by this profile');
        error.code = GIFT_NOT_OWNED;
        error.reservation = snapshot.exists() ? snapshot.data() : null;
        throw error;
      }
      transaction.delete(reservationRef);
    });

    state.reservations.delete(gift.id);
    elements.cancelSelectionModal.classList.add('hidden');
    state.cancelGift = null;
    state.cancelTrigger = null;
    showToast('Вы отказались от одного подарка. Остальные ваши подарки сохранены.');
    renderSelectedGifts();
    renderGifts();
  } catch (error) {
    if (error.code === GIFT_NOT_OWNED) {
      if (error.reservation) {
        state.reservations.set(gift.id, error.reservation);
      } else {
        state.reservations.delete(gift.id);
      }
      elements.cancelSelectionModal.classList.add('hidden');
      state.cancelGift = null;
      state.cancelTrigger = null;
      renderSelectedGifts();
      renderGifts();
      showToast('Этот подарок больше не закреплён за вашим профилем.');
    } else {
      showToast('Не получилось отказаться от подарка. Попробуйте ещё раз.');
      console.error(error);
    }
  } finally {
    state.pendingCancel = false;
    elements.keepGiftButton.disabled = false;
    elements.confirmCancelGiftButton.disabled = false;
    elements.confirmCancelGiftButton.textContent = 'Да, отказаться';
  }
}
```

Also add backdrop cancellation to `bindEvents`; `closeCancelSelectionModal` already refuses to close while `pendingCancel` is true:

```js
elements.cancelSelectionModal.addEventListener('click', (event) => {
  if (event.target === elements.cancelSelectionModal) closeCancelSelectionModal();
});
```

- [ ] **Step 6: Replace large selected-panel CSS with compact shared-card CSS**

Remove `.selected-copy`, `.cancel-gift-panel`, `.selected-gift img`, and old selected-panel layout rules. Add:

```css
.selected-gifts {
  margin-bottom: 24px;
  animation: selectedReveal 0.6s ease both;
}

.selected-gifts-heading {
  margin-top: 0;
}

.selected-gift-grid {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 250, 241, 0.96), rgba(239, 218, 190, 0.9));
}

.gift-body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.gift-action {
  min-height: 40px;
  margin-top: auto;
}

.cancel-gift-action {
  color: #7a3a29;
  border: 1px solid rgba(122, 58, 41, 0.22);
  background: rgba(255, 241, 229, 0.86);
}
```

Remove obsolete responsive `.selected-gift` and `.selected-copy` rules. The existing responsive `.gift-grid` rules then apply to both grids.

- [ ] **Step 7: Run focused verification**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-static-files.mjs
node tests/validate-gifts.mjs
```

Expected: all three unit tests pass, both validators print their success messages, and no switch-flow assertion fails.

- [ ] **Step 8: Commit multi-selection and individual cancellation**

```bash
git add app.js index.html styles.css tests/validate-static-files.mjs
git commit -m "feat: support multiple gift reservations"
```

### Task 4: Implement The Final Explanatory Handoff And Transactional Reservation

**Files:**
- Modify: `app.js:4-760`
- Modify: `styles.css:540-621`
- Modify: `tests/validate-static-files.mjs:38-105`

- [ ] **Step 1: Write failing handoff assertions**

Add these required snippets to `requiredAppSnippets`:

```js
"state.purchaseGift",
"openHandoffModal",
"returnToConfirmModal",
"reserveAndOpenMarketplace",
"transaction.set(reservationRef",
"error.code = GIFT_ALREADY_RESERVED",
"await wait(700)",
"window.location.assign(gift.marketUrl)"
```

Add these assertions after the required snippet loop:

```js
const selectedGiftIdMatches = app.match(/selectedGiftId/g) || [];
if (selectedGiftIdMatches.length !== 1 || !app.includes("selectedGiftId: ''")) {
  throw new Error('selectedGiftId must remain only as an empty profile compatibility field');
}

if (app.includes('window.open(')) {
  throw new Error('marketplace navigation must use the current tab');
}

if (app.includes("setDoc(doc(state.firestore, 'reservations'")) {
  throw new Error('reservation creation must use a transaction');
}
```

- [ ] **Step 2: Run the validator and verify it fails**

Run: `node tests/validate-static-files.mjs`

Expected: FAIL with `app.js missing state.purchaseGift`.

- [ ] **Step 3: Add purchase-flow state and event bindings**

Add the conflict constant, replace `confirmGift` with `purchaseGift` and `purchaseTrigger`, and retain the existing pending flag:

```js
const GIFT_ALREADY_RESERVED = 'gift-already-reserved';

purchaseGift: null,
purchaseTrigger: null,
pendingReservation: false,
```

Add all handoff elements from Task 2 to `elements`. Bind:

```js
elements.confirmGiftButton.addEventListener('click', openHandoffModal);
elements.handoffModal.addEventListener('click', (event) => {
  if (event.target === elements.handoffModal) closeHandoffModal();
});
elements.handoffBackButton.addEventListener('click', returnToConfirmModal);
elements.handoffConfirmButton.addEventListener('click', reserveAndOpenMarketplace);
```

Update the `Escape` handler to close both purchase dialogs and the cancellation dialog. Update logout to call `closeConfirmModal()`, `closeHandoffModal()`, and `closeCancelSelectionModal()` before clearing the profile.

- [ ] **Step 4: Implement both dialog transitions and current-tab navigation**

Replace `openConfirmModal`, `closeConfirmModal`, `reserveConfirmedGift`, and `openMarketLink` with:

```js
function openConfirmModal(gift, trigger) {
  if (!gift || !state.profile || !state.firestore) return;
  if (getReservationState(state.reservations.get(gift.id), state.profile.phone) !== 'free') return;

  state.purchaseGift = gift;
  state.purchaseTrigger = trigger;
  elements.confirmText.textContent = gift.title;
  elements.confirmPreview.innerHTML = renderGiftPreview(gift);
  elements.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  elements.confirmModal.classList.add('hidden');
  if (elements.handoffModal.classList.contains('hidden')) resetPurchaseFlow();
}

function openHandoffModal() {
  const gift = state.purchaseGift;
  if (!gift) return;

  elements.confirmModal.classList.add('hidden');
  elements.handoffPreview.innerHTML = renderGiftPreview(gift);
  elements.handoffStatus.classList.add('hidden');
  elements.handoffStatus.textContent = '';
  elements.handoffModal.classList.remove('hidden');
}

function returnToConfirmModal() {
  if (state.pendingReservation || !state.purchaseGift) return;
  elements.handoffModal.classList.add('hidden');
  elements.confirmModal.classList.remove('hidden');
}

function closeHandoffModal() {
  if (state.pendingReservation) return;
  elements.handoffModal.classList.add('hidden');
  resetPurchaseFlow();
}

function resetPurchaseFlow() {
  const trigger = state.purchaseTrigger;
  state.purchaseGift = null;
  state.purchaseTrigger = null;
  if (trigger?.isConnected) trigger.focus();
}

function renderGiftPreview(gift) {
  return `
    <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}">
    <div>
      <strong>${escapeHtml(gift.title)}</strong>
      <span>${escapeHtml(gift.description)}</span>
    </div>
  `;
}

function openMarketLink(gift) {
  window.location.assign(gift.marketUrl);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
```

- [ ] **Step 5: Create the reservation transaction before delayed navigation**

Add:

```js
async function reserveAndOpenMarketplace() {
  const gift = state.purchaseGift;
  if (!gift || !state.profile || !state.firestore) return;

  const { doc, runTransaction, serverTimestamp } = state.firebaseApi;
  const reservationRef = doc(state.firestore, 'reservations', gift.id);
  let navigating = false;

  try {
    state.pendingReservation = true;
    elements.handoffBackButton.disabled = true;
    elements.handoffConfirmButton.disabled = true;
    elements.handoffConfirmButton.textContent = 'Закрепляем…';

    await runTransaction(state.firestore, async (transaction) => {
      const snapshot = await transaction.get(reservationRef);
      if (snapshot.exists()) {
        const error = new Error('Gift is already reserved');
        error.code = GIFT_ALREADY_RESERVED;
        error.reservation = snapshot.data();
        throw error;
      }

      transaction.set(reservationRef, {
        phone: state.profile.phone,
        giftId: gift.id,
        firstName: state.profile.firstName,
        lastName: state.profile.lastName,
        displayName: state.profile.displayName,
        createdAt: serverTimestamp()
      });
    });

    state.reservations.set(gift.id, {
      phone: state.profile.phone,
      giftId: gift.id,
      firstName: state.profile.firstName,
      lastName: state.profile.lastName,
      displayName: state.profile.displayName
    });
    renderSelectedGifts();
    renderGifts();
    elements.handoffStatus.textContent = 'Подарок закреплён. Открываем магазин…';
    elements.handoffStatus.classList.remove('hidden');
    elements.handoffConfirmButton.textContent = 'Открываем…';
    navigating = true;
    await wait(700);
    window.location.assign(gift.marketUrl);
  } catch (error) {
    if (error.code === GIFT_ALREADY_RESERVED) {
      state.reservations.set(gift.id, error.reservation);
      elements.confirmModal.classList.add('hidden');
      elements.handoffModal.classList.add('hidden');
      resetPurchaseFlow();
      renderSelectedGifts();
      renderGifts();
      showToast('Этот подарок уже выбрали. Посмотрите другие варианты.');
    } else {
      showToast('Не получилось закрепить подарок. Проверьте соединение и попробуйте ещё раз.');
      console.error(error);
    }
  } finally {
    state.pendingReservation = false;
    if (!navigating) {
      elements.handoffBackButton.disabled = false;
      elements.handoffConfirmButton.disabled = false;
      elements.handoffConfirmButton.textContent = 'Понятно, перейти';
    }
  }
}
```

- [ ] **Step 6: Style the handoff status and pending actions**

Add:

```css
.handoff-status {
  margin: -4px 0 16px;
  padding: 10px 12px;
  border-radius: 7px;
  color: var(--cocoa) !important;
  background: var(--cream);
  font-weight: 850;
}

.confirm-actions button:disabled {
  cursor: wait;
  opacity: 0.68;
}
```

- [ ] **Step 7: Run focused tests and verify all handoff assertions pass**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-static-files.mjs
```

Expected: three unit tests pass and the static validator exits 0 without selected-field, popup, or transaction errors.

- [ ] **Step 8: Commit the handoff flow**

```bash
git add app.js styles.css tests/validate-static-files.mjs
git commit -m "feat: confirm gifts before marketplace handoff"
```

### Task 5: Update Documentation And Run Full Verification

**Files:**
- Modify: `README.md:1-52`
- Modify: `tests/validate-static-files.mjs:1-140`

- [ ] **Step 1: Add final documentation assertions before editing README**

Read the README in `tests/validate-static-files.mjs`:

```js
const readme = await readFile(new URL('README.md', root), 'utf8');
```

Add:

```js
for (const snippet of [
  'choose multiple baby gifts',
  'reservations/{giftId}',
  'source of truth',
  'node --test tests/registry-core.test.cjs'
]) {
  if (!readme.includes(snippet)) {
    throw new Error(`README.md missing ${snippet}`);
  }
}
```

- [ ] **Step 2: Run the validator and verify it fails on old documentation**

Run: `node tests/validate-static-files.mjs`

Expected: FAIL with `README.md missing choose multiple baby gifts`.

- [ ] **Step 3: Update README behavior, data model, and commands**

Replace the opening with:

```markdown
# Baby Gift Registry

Static GitHub Pages site where friends can choose multiple baby gifts. The public gift catalog lives in `gifts.json`; shared reservations live in Firebase Firestore.

Guests log in with a phone number. The app stores only that phone number in `localStorage`; names are loaded from Firestore user documents, while `reservations/{giftId}` is the source of truth for every selected gift. A guest can release one reservation without affecting their other gifts.
```

Add the unit command to the validation block:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-gifts.mjs
node tests/validate-static-files.mjs
node tests/validate-pages-workflow.mjs
```

Replace the Firestore summary with:

```markdown
Firestore uses:

- `users/{phone}` for phone-based profiles; the legacy empty `selectedGiftId` remains only for deployed-rule compatibility
- `reservations/{giftId}` as the source of truth for shared gift reservation state

A phone may own any number of reservation documents. Cancelling a gift deletes only its reservation.
```

- [ ] **Step 4: Run the complete automated suite**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-gifts.mjs
node tests/validate-static-files.mjs
node tests/validate-pages-workflow.mjs
```

Expected: three core tests pass; gift, static-file, and Pages validators each print their success message; all commands exit 0.

- [ ] **Step 5: Run a local HTTP smoke test**

Start the server from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

In a second shell, run:

```bash
curl -sS -o /dev/null -w 'index=%{http_code}\n' http://127.0.0.1:4173/
curl -sS -o /dev/null -w 'core=%{http_code}\n' http://127.0.0.1:4173/registry-core.js
curl -sS -o /dev/null -w 'app=%{http_code}\n' http://127.0.0.1:4173/app.js
curl -sS -o /dev/null -w 'gifts=%{http_code}\n' http://127.0.0.1:4173/gifts.json
```

Expected: `index=200`, `core=200`, `app=200`, and `gifts=200`. Stop the server after the checks.

- [ ] **Step 6: Complete browser behavior verification**

With Firebase configured, verify this exact sequence:

1. Sign in and reserve one free gift through both dialogs.
2. Confirm that the success message remains visible for 700 ms before same-tab navigation.
3. Return to the registry and reserve a second free gift.
4. Confirm both equal-height cards appear under `Ваши подарки`, with both `Отказаться` buttons aligned at the bottom.
5. Confirm both gifts also remain in `Все подарки` with `Этот подарок покупаете вы` and direct marketplace navigation.
6. Cancel one selected gift and confirm the other remains selected.
7. Attempt a concurrent reservation from another profile and confirm the losing profile does not navigate.
8. Repeat card and dialog actions with `Tab`, `Enter`, `Space`, and `Escape` at desktop and mobile widths.

Expected: every step matches the approved specification; network/conflict failures never navigate to the marketplace.

- [ ] **Step 7: Inspect the final diff and commit documentation**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, only planned files are modified, and `.superpowers/` is not staged.

Commit:

```bash
git add README.md tests/validate-static-files.mjs
git commit -m "docs: explain multiple gift reservations"
```

- [ ] **Step 8: Re-run the automated suite from the committed tree**

Run:

```bash
node --test tests/registry-core.test.cjs
node tests/validate-gifts.mjs
node tests/validate-static-files.mjs
node tests/validate-pages-workflow.mjs
git status --short
```

Expected: all checks pass. The only permitted status entry is the ignored or untracked brainstorming directory `.superpowers/`; no implementation file remains modified.
