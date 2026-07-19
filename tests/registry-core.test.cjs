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
