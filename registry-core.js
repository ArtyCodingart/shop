(function attachGiftRegistryCore(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.giftRegistryCore = api;
  }
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
