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

  async function deleteOwnedReservation({ firestore, reservationRef, phone, runTransaction }) {
    return runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reservationRef);
      if (!snapshot.exists() || snapshot.data().phone !== phone) {
        const error = new Error('Gift is not reserved by this profile');
        error.code = 'gift-not-owned';
        error.reservation = snapshot.exists() ? snapshot.data() : null;
        throw error;
      }

      transaction.delete(reservationRef);
    });
  }

  return Object.freeze({
    deleteOwnedReservation,
    getOwnedGifts,
    getReservationState
  });
});
