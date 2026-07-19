const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const registryCore = require('../registry-core.js');

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
    this.element.className = [...this.values].join(' ');
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
    this.element.className = [...this.values].join(' ');
  }

  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : force;
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    this.element.className = [...this.values].join(' ');
    return shouldAdd;
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.disabled = false;
    this.isConnected = true;
    this.focusCount = 0;
    this._className = '';
    this._innerHTML = '';
    this.textContent = '';
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this._className = value;
    this.classList?.values.clear();
    String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classList?.values.add(name));
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.replaceChildren();

    for (const match of this._innerHTML.matchAll(/<img\b[^>]*>/gi)) {
      const image = new FakeElement('img', this.ownerDocument);
      image.sourceMarkup = match[0];
      this.append(image);
    }

    const statusMatch = this._innerHTML.match(/<p class="gift-status">([\s\S]*?)<\/p>/i);
    if (statusMatch) {
      const status = new FakeElement('p', this.ownerDocument);
      status.className = 'gift-status';
      status.textContent = statusMatch[1].replace(/<[^>]*>/g, '');
      this.append(status);
    }

    const buttonMatch = this._innerHTML.match(/<button class="([^"]+)"[^>]*(disabled)?[^>]*>([\s\S]*?)<\/button>/i);
    if (buttonMatch) {
      const button = new FakeElement('button', this.ownerDocument);
      button.className = buttonMatch[1];
      button.disabled = Boolean(buttonMatch[2]);
      button.textContent = buttonMatch[3].trim();
      this.append(button);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      child.setConnected(this.isConnected);
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children.forEach((child) => child.setConnected(false));
    this.children = [];
    this.append(...children);
  }

  setConnected(value) {
    this.isConnected = value;
    this.children.forEach((child) => child.setConnected(value));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'disabled') this.disabled = true;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    if (!event.propagationStopped && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click() {
    if (!this.disabled) this.dispatchEvent(createEvent('click'));
  }

  press(key) {
    if (this.disabled) return;
    const event = createEvent('keydown', { key });
    this.dispatchEvent(event);
    if (!event.defaultPrevented && (key === 'Enter' || key === ' ')) this.click();
  }

  focus() {
    this.focusCount += 1;
    this.ownerDocument.activeElement = this;
  }

  contains(element) {
    return element === this || this.children.some((child) => child.contains(element));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const all = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (matches(child, selector)) all.push(child);
        visit(child);
      }
    };
    visit(this);
    return all;
  }
}

function matches(element, selector) {
  if (selector === 'button') return element.tagName === 'BUTTON';
  if (/^[a-z][a-z0-9]*$/i.test(selector)) return element.tagName === selector.toUpperCase();
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  if (selector.includes('button:not([disabled])')) return element.tagName === 'BUTTON' && !element.disabled;
  return false;
}

function createEvent(type, values = {}) {
  return {
    type,
    key: '',
    shiftKey: false,
    target: null,
    currentTarget: null,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...values
  };
}

function createFakeDocument() {
  const elements = new Map();
  const listeners = new Map();
  const document = {
    activeElement: null,
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement('div', document));
      return elements.get(selector);
    },
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatchEvent(event) {
      if (!event.target) event.target = document;
      event.currentTarget = document;
      for (const listener of listeners.get(event.type) || []) listener(event);
      return !event.defaultPrevented;
    }
  };

  for (const selector of [
    '#loginForm', '#registerForm', '#accountTrigger', '#logoutButton', '#confirmModal', '#confirmDialog',
    '#cancelConfirmButton', '#confirmGiftButton', '#handoffModal', '#handoffDialog', '#handoffBackButton',
    '#handoffConfirmButton', '#cancelSelectionModal', '#cancelSelectionDialog', '#keepGiftButton',
    '#confirmCancelGiftButton'
  ]) {
    const tagName = selector.includes('Form') ? 'form' : selector.includes('Dialog') ? 'article' : selector.includes('Modal') ? 'div' : 'button';
    elements.set(selector, new FakeElement(tagName, document));
  }

  const confirmModal = elements.get('#confirmModal');
  const confirmDialog = elements.get('#confirmDialog');
  confirmDialog.append(elements.get('#cancelConfirmButton'), elements.get('#confirmGiftButton'));
  confirmModal.append(confirmDialog);
  confirmModal.classList.add('hidden');

  const handoffModal = elements.get('#handoffModal');
  const handoffDialog = elements.get('#handoffDialog');
  handoffDialog.append(elements.get('#handoffBackButton'), elements.get('#handoffConfirmButton'));
  handoffModal.append(handoffDialog);
  handoffModal.classList.add('hidden');

  const cancelModal = elements.get('#cancelSelectionModal');
  const cancelDialog = elements.get('#cancelSelectionDialog');
  cancelDialog.append(elements.get('#keepGiftButton'), elements.get('#confirmCancelGiftButton'));
  cancelModal.append(cancelDialog);
  cancelModal.classList.add('hidden');
  document.querySelector('#handoffStatus').classList.add('hidden');
  return document;
}

function loadApp() {
  const document = createFakeDocument();
  let marketOpenCount = 0;
  const marketAssignments = [];
  const timers = [];
  const sandbox = {
    console: { error() {} },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: {
      protocol: 'https:',
      assign(url) { marketAssignments.push(url); }
    },
    giftRegistryFirebase: { config: {}, isConfigured: false },
    giftRegistryCore: registryCore,
    open() { marketOpenCount += 1; },
    clearTimeout() {},
    setTimeout(callback, delay) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timers.length;
    }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const source = readFileSync(require.resolve('../app.js'), 'utf8')
    .replace('\ninit();\n', '\n')
    + `\n;globalThis.__appTest = {
      state,
      elements,
      bindEvents,
      createGiftCard,
      openConfirmModal,
      closeConfirmModal,
      openHandoffModal: typeof openHandoffModal === 'function' ? openHandoffModal : undefined,
      returnToConfirmModal: typeof returnToConfirmModal === 'function' ? returnToConfirmModal : undefined,
      closeHandoffModal: typeof closeHandoffModal === 'function' ? closeHandoffModal : undefined,
      reserveAndOpenMarketplace: typeof reserveAndOpenMarketplace === 'function' ? reserveAndOpenMarketplace : undefined,
      openCancelSelectionModal,
      closeCancelSelectionModal,
      cancelSelectedGift
    };`;
  vm.runInContext(source, context);
  context.__appTest.bindEvents();

  return {
    ...context.__appTest,
    document,
    getMarketOpenCount: () => marketOpenCount + marketAssignments.length,
    getMarketAssignments: () => [...marketAssignments],
    getTimers: () => timers.filter((timer) => !timer.cleared),
    runTimer(delay) {
      const timer = timers.find((candidate) => !candidate.cleared && candidate.delay === delay);
      assert.ok(timer, `expected a pending ${delay} ms timer`);
      timer.cleared = true;
      timer.callback();
    }
  };
}

function gift(overrides = {}) {
  return {
    id: 'target',
    title: 'Коляска',
    category: 'Прогулка',
    description: 'Описание',
    imageUrl: './image.jpg',
    marketUrl: 'https://example.test/gift',
    ...overrides
  };
}

function prepareOwnedCard(app) {
  const selectedGift = gift();
  app.state.profile = { phone: '77000000000', displayName: 'Гость' };
  app.state.firebaseReady = true;
  app.state.reservationsLoaded = true;
  app.state.reservationsFailed = false;
  app.state.firestore = {};
  app.state.reservations = new Map([[selectedGift.id, { phone: app.state.profile.phone, displayName: 'Гость' }]]);
  const card = app.createGiftCard(selectedGift, 'selected');
  app.elements.selectedGiftGrid.append(card);
  return { selectedGift, card };
}

function prepareFreeCard(app, overrides = {}) {
  const freeGift = gift(overrides);
  app.state.profile = {
    phone: '77000000000',
    firstName: 'Тест',
    lastName: 'Гость',
    displayName: 'Тест Гость'
  };
  app.state.firebaseReady = true;
  app.state.reservationsLoaded = true;
  app.state.reservationsFailed = false;
  app.state.firestore = {};
  app.state.gifts = [freeGift];
  app.state.giftsLoaded = true;
  app.state.reservations = new Map();
  const card = app.createGiftCard(freeGift, 'catalog');
  app.elements.giftGrid.append(card);
  return { freeGift, card };
}

test('renders a hostile reservation display name as text, never markup', () => {
  const app = loadApp();
  const hostileName = '<img src=x onerror=alert(1)>';
  const reservedGift = gift();
  app.state.profile = { phone: '77000000000' };
  app.state.firebaseReady = true;
  app.state.reservationsFailed = false;
  app.state.reservations = new Map([[reservedGift.id, { phone: '78000000000', displayName: hostileName }]]);

  const card = app.createGiftCard(reservedGift, 'catalog');
  const status = card.querySelector('.gift-status');

  assert.equal(status.textContent, `Уже покупает ${hostileName}.`);
  assert.equal(card.querySelectorAll('img').length, 1, 'hostile status must not create another image element');
});

test('card main control is an empty sibling overlay with resolvable unique ARIA references', () => {
  const app = loadApp();
  const sharedGift = gift({ id: 'gift / один' });
  app.state.profile = { phone: '77000000000' };
  app.state.firebaseReady = true;
  app.state.reservationsFailed = false;
  app.state.reservations = new Map([[sharedGift.id, { phone: '78000000000', displayName: 'Гость' }]]);

  const catalogCard = app.createGiftCard(sharedGift, 'catalog');
  app.state.reservations.set(sharedGift.id, { phone: app.state.profile.phone, displayName: 'Вы' });
  const selectedCard = app.createGiftCard(sharedGift, 'selected');
  const main = catalogCard.querySelector('.gift-card-main');
  const action = catalogCard.querySelector('.gift-action');
  const title = catalogCard.querySelector('h2');
  const description = catalogCard.querySelector('.gift-description');
  const status = catalogCard.querySelector('.gift-status');

  assert.equal(main.children.length, 0, 'main button must not contain block or heading content');
  assert.equal(main.parentNode, catalogCard);
  assert.equal(action.parentNode, catalogCard);
  assert.equal(title.parentNode, catalogCard.querySelector('.gift-body'));
  assert.equal(description.parentNode, title.parentNode);
  assert.equal(status.parentNode, title.parentNode);
  assert.equal(main.getAttribute('aria-labelledby'), title.id);
  assert.deepEqual(main.getAttribute('aria-describedby').split(' '), [description.id, status.id]);
  assert.equal(findById(catalogCard, title.id), title);
  assert.equal(findById(catalogCard, description.id), description);
  assert.equal(findById(catalogCard, status.id), status);
  assert.notEqual(selectedCard.querySelector('h2').id, title.id, 'selected and catalog copies need unique ids');
});

for (const activation of ['click', 'Enter', ' ']) {
  test(`selected-card cancel ${JSON.stringify(activation)} invokes cancellation without marketplace activation`, () => {
    const app = loadApp();
    const { selectedGift, card } = prepareOwnedCard(app);
    const action = card.querySelector('.gift-action');

    if (activation === 'click') action.click();
    else action.press(activation);

    assert.equal(app.state.cancelGift, selectedGift);
    assert.equal(app.getMarketOpenCount(), 0);
  });
}

test('cancellation modal receives focus and traps Tab', () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  const trigger = card.querySelector('.gift-action');

  app.openCancelSelectionModal(selectedGift, trigger);
  assert.equal(app.document.activeElement, app.elements.keepGiftButton);

  app.elements.confirmCancelGiftButton.focus();
  const tab = createEvent('keydown', { key: 'Tab' });
  app.elements.cancelSelectionModal.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(app.document.activeElement, app.elements.keepGiftButton);
});

test('manual cancellation close restores focus by stable gift id after a rerender', () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  const oldTrigger = card.querySelector('.gift-action');
  app.openCancelSelectionModal(selectedGift, oldTrigger);
  card.setConnected(false);

  const catalogCard = app.createGiftCard(selectedGift, 'catalog');
  app.elements.giftGrid.append(catalogCard);
  const catalogMain = catalogCard.querySelector('.gift-card-main');
  assert.ok(catalogMain, 'catalog card must expose a stable main control');
  app.closeCancelSelectionModal();

  assert.equal(app.document.activeElement, catalogMain);
});

test('successful cancellation restores focus to the rerendered catalog main control', async () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  app.state.gifts = [selectedGift];
  app.state.giftsLoaded = true;
  app.openCancelSelectionModal(selectedGift, card.querySelector('.gift-action'));
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    runTransaction: async (firestore, update) => update({
      async get() { return snapshot({ phone: app.state.profile.phone }); },
      delete() {}
    })
  };

  await app.cancelSelectedGift();

  const catalogMain = app.elements.giftGrid.querySelector('.gift-card-main');
  assert.ok(catalogMain);
  assert.equal(app.document.activeElement, catalogMain);
});

test('ownership-conflict cancellation restores focus to a stable heading fallback', async () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  const actualReservation = { phone: '78000000000', displayName: 'Другой гость' };
  app.state.gifts = [selectedGift];
  app.state.giftsLoaded = true;
  app.openCancelSelectionModal(selectedGift, card.querySelector('.gift-action'));
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    runTransaction: async (firestore, update) => update({
      async get() { return snapshot(actualReservation); },
      delete() { throw new Error('must not delete'); }
    })
  };

  await app.cancelSelectedGift();

  assert.equal(app.state.reservations.get(selectedGift.id).phone, actualReservation.phone);
  assert.equal(app.document.activeElement, app.elements.giftListTitle);
});

test('transient cancellation failure keeps the modal open, focused, and retryable', async () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  app.openCancelSelectionModal(selectedGift, card.querySelector('.gift-action'));
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    runTransaction: async () => { throw new Error('network unavailable'); }
  };

  await app.cancelSelectedGift();

  assert.equal(app.elements.cancelSelectionModal.classList.contains('hidden'), false);
  assert.equal(app.document.activeElement, app.elements.confirmCancelGiftButton);
  assert.equal(app.state.cancelGift, selectedGift);
  assert.equal(app.elements.confirmCancelGiftButton.disabled, false);
});

test('pending cancellation focuses a busy dialog and traps Tab until the transaction settles', async () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  const transaction = deferred();
  app.openCancelSelectionModal(selectedGift, card.querySelector('.gift-action'));
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    runTransaction: () => transaction.promise
  };

  const cancellation = app.cancelSelectedGift();

  assert.equal(app.state.pendingCancel, true);
  assert.equal(app.elements.keepGiftButton.disabled, true);
  assert.equal(app.elements.confirmCancelGiftButton.disabled, true);
  assert.ok(app.elements.cancelSelectionDialog, 'app must retain the dialog focus target');
  assert.equal(app.elements.cancelSelectionDialog.getAttribute('aria-busy'), 'true');
  assert.equal(app.document.activeElement, app.elements.cancelSelectionDialog);

  const tab = createEvent('keydown', { key: 'Tab' });
  app.elements.cancelSelectionModal.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(app.document.activeElement, app.elements.cancelSelectionDialog);

  transaction.reject(new Error('network unavailable'));
  await cancellation;

  assert.equal(app.elements.cancelSelectionDialog.getAttribute('aria-busy'), null);
  assert.equal(app.elements.keepGiftButton.disabled, false);
  assert.equal(app.elements.confirmCancelGiftButton.disabled, false);
  assert.equal(app.document.activeElement, app.elements.confirmCancelGiftButton);
});

test('the short confirmation opens the explanatory handoff without writing a reservation', async () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  let directWrites = 0;
  let transactionRuns = 0;
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    serverTimestamp: () => 'timestamp',
    setDoc: async () => { directWrites += 1; },
    runTransaction: async () => { transactionRuns += 1; }
  };

  card.querySelector('.gift-action').click();

  assert.equal(app.elements.confirmModal.classList.contains('hidden'), false);
  assert.equal(app.elements.confirmText.textContent, freeGift.title);
  assert.equal(directWrites, 0);
  assert.equal(transactionRuns, 0);

  app.elements.confirmGiftButton.click();
  await Promise.resolve();

  assert.equal(directWrites, 0, 'the first confirmation must not create a reservation');
  assert.equal(transactionRuns, 0, 'the transaction starts only from the final handoff button');
  assert.equal(app.elements.confirmModal.classList.contains('hidden'), true);
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), false);
  assert.equal(app.state.purchaseGift, freeGift);
});

for (const selector of ['.gift-card-main', '.gift-action']) {
  test(`closing the first purchase modal restores the exact ${selector} trigger`, () => {
    const app = loadApp();
    const { card } = prepareFreeCard(app);
    const trigger = card.querySelector(selector);

    trigger.click();

    assert.equal(app.document.activeElement, app.elements.cancelConfirmButton);
    app.elements.confirmGiftButton.focus();
    const tab = createEvent('keydown', { key: 'Tab' });
    app.elements.confirmModal.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, true);
    assert.equal(app.document.activeElement, app.elements.cancelConfirmButton);

    app.closeConfirmModal();
    assert.equal(app.document.activeElement, trigger);
  });
}

test('closing the first purchase modal after a rerender restores the same control kind', () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  const oldAction = card.querySelector('.gift-action');
  oldAction.click();

  const replacementCard = app.createGiftCard(freeGift, 'catalog');
  app.elements.giftGrid.replaceChildren(replacementCard);
  app.closeConfirmModal();

  assert.equal(app.document.activeElement, replacementCard.querySelector('.gift-action'));
});

test('handoff focus is trapped and Back returns to the first modal', () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  const trigger = card.querySelector('.gift-action');

  app.openConfirmModal(freeGift, trigger);
  assert.equal(typeof app.openHandoffModal, 'function');
  app.openHandoffModal();

  assert.equal(app.elements.confirmModal.classList.contains('hidden'), true);
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), false);
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffBackButton'));

  app.document.querySelector('#handoffConfirmButton').focus();
  const tab = createEvent('keydown', { key: 'Tab' });
  app.document.querySelector('#handoffModal').dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffBackButton'));

  app.returnToConfirmModal();
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), true);
  assert.equal(app.elements.confirmModal.classList.contains('hidden'), false);
  assert.equal(app.document.activeElement, app.elements.confirmGiftButton);

  app.closeConfirmModal();
  assert.equal(app.document.activeElement, trigger);
});

test('both purchase previews render hostile catalog content only as text', () => {
  const app = loadApp();
  const hostileTitle = '<img src=x onerror=alert(1)>';
  const hostileDescription = '<script>alert(1)</script>';
  const { freeGift, card } = prepareFreeCard(app, {
    title: hostileTitle,
    description: hostileDescription
  });

  app.openConfirmModal(freeGift, card.querySelector('.gift-card-main'));
  assert.equal(app.elements.confirmPreview.querySelectorAll('img').length, 1);
  assert.equal(app.elements.confirmPreview.querySelector('img').alt, hostileTitle);
  assert.equal(app.elements.confirmPreview.querySelector('strong').textContent, hostileTitle);
  assert.equal(app.elements.confirmPreview.querySelector('span').textContent, hostileDescription);

  assert.equal(typeof app.openHandoffModal, 'function');
  app.openHandoffModal();
  const handoffPreview = app.document.querySelector('#handoffPreview');
  assert.equal(handoffPreview.querySelectorAll('img').length, 1);
  assert.equal(handoffPreview.querySelector('strong').textContent, hostileTitle);
  assert.equal(handoffPreview.querySelector('span').textContent, hostileDescription);
});

test('final confirmation reserves transactionally, updates UI, waits exactly 700 ms, then assigns the current tab', async () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  const writes = [];
  let transactionRuns = 0;
  const timestamp = { kind: 'server-timestamp' };
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    serverTimestamp: () => timestamp,
    runTransaction: async (firestore, update) => {
      transactionRuns += 1;
      return update({
        async get() { return snapshot(null); },
        set(ref, data) { writes.push({ ref, data }); }
      });
    }
  };
  app.openConfirmModal(freeGift, card.querySelector('.gift-card-main'));
  assert.equal(typeof app.openHandoffModal, 'function');
  assert.equal(typeof app.reserveAndOpenMarketplace, 'function');
  app.openHandoffModal();

  const reservation = app.reserveAndOpenMarketplace();
  await waitForTimer(app, 700);

  assert.equal(transactionRuns, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref.collection, 'reservations');
  assert.equal(writes[0].ref.id, freeGift.id);
  assert.equal(writes[0].data.phone, app.state.profile.phone);
  assert.equal(writes[0].data.giftId, freeGift.id);
  assert.equal(writes[0].data.createdAt, timestamp);
  assert.equal(app.state.reservations.get(freeGift.id).phone, app.state.profile.phone);
  assert.equal(app.elements.selectedGiftGrid.children.length, 1);
  assert.equal(app.getMarketAssignments().length, 0, 'navigation must wait for the visible success delay');
  assert.equal(app.getTimers().filter((timer) => timer.delay === 700).length, 1);
  assert.equal(app.document.querySelector('#handoffStatus').textContent, 'Подарок закреплён. Открываем магазин…');
  assert.equal(app.document.querySelector('#handoffStatus').classList.contains('hidden'), false);
  assert.equal(app.state.pendingReservation, true);
  assert.equal(app.document.querySelector('#handoffDialog').getAttribute('aria-busy'), 'true');
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffDialog'));

  app.runTimer(700);
  await reservation;

  assert.deepEqual(app.getMarketAssignments(), [freeGift.marketUrl]);
});

test('pending reservation blocks duplicate, Back, backdrop, Escape, and Tab escape; a network error remains retryable', async () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  const pendingTransaction = deferred();
  let transactionRuns = 0;
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    serverTimestamp: () => 'timestamp',
    runTransaction: () => {
      transactionRuns += 1;
      return pendingTransaction.promise;
    }
  };
  app.openConfirmModal(freeGift, card.querySelector('.gift-action'));
  assert.equal(typeof app.openHandoffModal, 'function');
  assert.equal(typeof app.reserveAndOpenMarketplace, 'function');
  app.openHandoffModal();

  const reservation = app.reserveAndOpenMarketplace();
  const duplicate = app.reserveAndOpenMarketplace();
  assert.equal(transactionRuns, 1);
  assert.equal(app.state.pendingReservation, true);
  assert.equal(app.document.querySelector('#handoffBackButton').disabled, true);
  assert.equal(app.document.querySelector('#handoffConfirmButton').disabled, true);
  assert.equal(app.document.querySelector('#handoffDialog').getAttribute('aria-busy'), 'true');
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffDialog'));

  app.returnToConfirmModal();
  app.document.querySelector('#handoffModal').dispatchEvent(createEvent('click', {
    target: app.document.querySelector('#handoffModal')
  }));
  app.document.dispatchEvent(createEvent('keydown', { key: 'Escape' }));
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), false);
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffDialog'));

  const tab = createEvent('keydown', { key: 'Tab' });
  app.document.querySelector('#handoffModal').dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffDialog'));

  await duplicate;
  pendingTransaction.reject(new Error('network unavailable'));
  await reservation;

  assert.equal(app.getMarketAssignments().length, 0);
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), false);
  assert.equal(app.state.purchaseGift, freeGift);
  assert.equal(app.state.pendingReservation, false);
  assert.equal(app.document.querySelector('#handoffDialog').getAttribute('aria-busy'), null);
  assert.equal(app.document.querySelector('#handoffBackButton').disabled, false);
  assert.equal(app.document.querySelector('#handoffConfirmButton').disabled, false);
  assert.equal(app.document.activeElement, app.document.querySelector('#handoffConfirmButton'));

  app.state.firebaseApi.runTransaction = async (firestore, update) => update({
    async get() { return snapshot(null); },
    set() {}
  });
  const retry = app.reserveAndOpenMarketplace();
  await waitForTimer(app, 700);
  app.runTimer(700);
  await retry;
  assert.deepEqual(app.getMarketAssignments(), [freeGift.marketUrl]);
});

test('a reservation conflict rerenders before restoring stable focus and never navigates', async () => {
  const app = loadApp();
  const { freeGift, card } = prepareFreeCard(app);
  const competingReservation = { phone: '78000000000', displayName: 'Другой гость' };
  let writes = 0;
  app.state.firebaseApi = {
    doc: (firestore, collection, id) => ({ collection, id }),
    serverTimestamp: () => 'timestamp',
    runTransaction: async (firestore, update) => update({
      async get() { return snapshot(competingReservation); },
      set() { writes += 1; }
    })
  };
  app.openConfirmModal(freeGift, card.querySelector('.gift-action'));
  assert.equal(typeof app.openHandoffModal, 'function');
  assert.equal(typeof app.reserveAndOpenMarketplace, 'function');
  app.openHandoffModal();

  await app.reserveAndOpenMarketplace();

  assert.equal(writes, 0);
  assert.equal(app.state.reservations.get(freeGift.id), competingReservation);
  assert.equal(app.getMarketAssignments().length, 0);
  assert.equal(app.elements.confirmModal.classList.contains('hidden'), true);
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), true);
  assert.equal(app.state.purchaseGift, null);
  assert.equal(app.document.activeElement, app.elements.giftListTitle);
});

test('an owned card assigns the marketplace directly without reopening purchase dialogs', () => {
  const app = loadApp();
  const { selectedGift, card } = prepareOwnedCard(app);
  let transactionRuns = 0;
  app.state.firebaseApi = {
    runTransaction: async () => { transactionRuns += 1; }
  };

  card.querySelector('.gift-card-main').click();

  assert.deepEqual(app.getMarketAssignments(), [selectedGift.marketUrl]);
  assert.equal(transactionRuns, 0);
  assert.equal(app.elements.confirmModal.classList.contains('hidden'), true);
  assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), true);
});

for (const selector of ['.gift-card-main', '.gift-action']) {
  test(`an owned catalog ${selector} assigns directly without a modal or transaction`, () => {
    const app = loadApp();
    const { selectedGift } = prepareOwnedCard(app);
    const catalogCard = app.createGiftCard(selectedGift, 'catalog');
    app.elements.giftGrid.append(catalogCard);
    let transactionRuns = 0;
    app.state.firebaseApi = {
      runTransaction: async () => { transactionRuns += 1; }
    };

    catalogCard.querySelector(selector).click();

    assert.deepEqual(app.getMarketAssignments(), [selectedGift.marketUrl]);
    assert.equal(transactionRuns, 0);
    assert.equal(app.state.purchaseGift, null);
    assert.equal(app.elements.confirmModal.classList.contains('hidden'), true);
    assert.equal(app.document.querySelector('#handoffModal').classList.contains('hidden'), true);
  });
}

test('owned reservation transaction deletes exactly the requested reservation', async () => {
  assert.equal(typeof registryCore.deleteOwnedReservation, 'function');
  const targetRef = { id: 'target' };
  const deleted = [];

  await registryCore.deleteOwnedReservation({
    firestore: {},
    reservationRef: targetRef,
    phone: '77000000000',
    runTransaction: async (firestore, update) => update({
      async get() { return snapshot({ phone: '77000000000' }); },
      delete(ref) { deleted.push(ref); }
    })
  });

  assert.deepEqual(deleted, [targetRef]);
});

test('owned reservation transaction rejects missing ownership without deleting', async () => {
  assert.equal(typeof registryCore.deleteOwnedReservation, 'function');
  const deleted = [];

  await assert.rejects(
    registryCore.deleteOwnedReservation({
      firestore: {},
      reservationRef: { id: 'target' },
      phone: '77000000000',
      runTransaction: async (firestore, update) => update({
        async get() { return snapshot(null); },
        delete(ref) { deleted.push(ref); }
      })
    }),
    (error) => error.code === 'gift-not-owned' && error.reservation === null
  );
  assert.deepEqual(deleted, []);
});

test('owned reservation transaction preserves mismatched reservation data in its rejection', async () => {
  assert.equal(typeof registryCore.deleteOwnedReservation, 'function');
  const actualReservation = { phone: '78000000000', displayName: 'Другой гость' };

  await assert.rejects(
    registryCore.deleteOwnedReservation({
      firestore: {},
      reservationRef: { id: 'target' },
      phone: '77000000000',
      runTransaction: async (firestore, update) => update({
        async get() { return snapshot(actualReservation); },
        delete() { throw new Error('must not delete'); }
      })
    }),
    (error) => error.code === 'gift-not-owned' && error.reservation === actualReservation
  );
});

test('owned reservation transaction propagates transient errors for retry', async () => {
  assert.equal(typeof registryCore.deleteOwnedReservation, 'function');
  const transient = new Error('network unavailable');

  await assert.rejects(
    registryCore.deleteOwnedReservation({
      firestore: {},
      reservationRef: { id: 'target' },
      phone: '77000000000',
      runTransaction: async () => { throw transient; }
    }),
    transient
  );
});

function snapshot(data) {
  return {
    exists: () => data !== null,
    data: () => data
  };
}

function findById(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const match = findById(child, id);
    if (match) return match;
  }
  return null;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForTimer(app, delay) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (app.getTimers().some((timer) => timer.delay === delay)) return;
    await Promise.resolve();
  }
  assert.fail(`expected a pending ${delay} ms timer`);
}
