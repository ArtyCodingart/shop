const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
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

test('exports through CommonJS without attaching to the Node global', () => {
  const modulePath = require.resolve('../registry-core.js');

  delete globalThis.giftRegistryCore;
  delete require.cache[modulePath];

  const api = require('../registry-core.js');

  assert.equal(globalThis.giftRegistryCore, undefined);
  assert.equal(typeof api.getReservationState, 'function');
});

test('attaches a frozen API in the browser branch', () => {
  const source = readFileSync(require.resolve('../registry-core.js'), 'utf8');
  const browser = vm.createContext({});

  vm.runInContext(source, browser);

  assert.equal(typeof browser.giftRegistryCore.getReservationState, 'function');
  assert.equal(typeof browser.giftRegistryCore.getOwnedGifts, 'function');
  assert.equal(Object.isFrozen(browser.giftRegistryCore), true);
});
