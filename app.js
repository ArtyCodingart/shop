const STORAGE_PHONE_KEY = 'babyGiftRegistry.phone';
const firebaseSettings = window.giftRegistryFirebase || { config: {}, isConfigured: false };
const { getOwnedGifts, getReservationState } = window.giftRegistryCore;
const GIFT_NOT_OWNED = 'gift-not-owned';

const state = {
  booting: true,
  phone: localStorage.getItem(STORAGE_PHONE_KEY),
  pendingPhone: null,
  profile: null,
  giftsLoaded: false,
  reservationsLoaded: false,
  reservationsFailed: false,
  gifts: [],
  reservations: new Map(),
  confirmGift: null,
  cancelGift: null,
  cancelTrigger: null,
  pendingLogin: false,
  pendingProfile: false,
  pendingReservation: false,
  pendingCancel: false,
  firestore: null,
  firebaseReady: false,
  firebaseApi: null
};

const elements = {
  bootView: document.querySelector('#bootView'),
  loginView: document.querySelector('#loginView'),
  registerView: document.querySelector('#registerView'),
  catalogView: document.querySelector('#catalogView'),
  loginForm: document.querySelector('#loginForm'),
  registerForm: document.querySelector('#registerForm'),
  phoneNumber: document.querySelector('#phoneNumber'),
  loginButton: document.querySelector('#loginButton'),
  registerFirstName: document.querySelector('#registerFirstName'),
  registerLastName: document.querySelector('#registerLastName'),
  registerButton: document.querySelector('#registerButton'),
  accountMenu: document.querySelector('#accountMenu'),
  accountTrigger: document.querySelector('#accountTrigger'),
  accountInitials: document.querySelector('#accountInitials'),
  accountDropdown: document.querySelector('#accountDropdown'),
  profileName: document.querySelector('#profileName'),
  logoutButton: document.querySelector('#logoutButton'),
  statusBanner: document.querySelector('#statusBanner'),
  selectedGiftSection: document.querySelector('#selectedGiftSection'),
  selectedGiftGrid: document.querySelector('#selectedGiftGrid'),
  giftGrid: document.querySelector('#giftGrid'),
  confirmModal: document.querySelector('#confirmModal'),
  confirmText: document.querySelector('#confirmText'),
  confirmPreview: document.querySelector('#confirmPreview'),
  cancelConfirmButton: document.querySelector('#cancelConfirmButton'),
  confirmGiftButton: document.querySelector('#confirmGiftButton'),
  cancelSelectionModal: document.querySelector('#cancelSelectionModal'),
  cancelSelectionText: document.querySelector('#cancelSelectionText'),
  keepGiftButton: document.querySelector('#keepGiftButton'),
  confirmCancelGiftButton: document.querySelector('#confirmCancelGiftButton'),
  toast: document.querySelector('#toast')
};

init();

async function init() {
  bindEvents();
  await loadGifts();
  await setupFirebase();

  if (state.phone && state.firebaseReady) {
    await loadUserByPhone(state.phone);
  }

  showLocalFileHint();
  state.booting = false;
  render();
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handlePhoneLogin);
  elements.registerForm.addEventListener('submit', createUserProfile);
  elements.accountTrigger.addEventListener('click', toggleAccountMenu);
  elements.logoutButton.addEventListener('click', clearProfile);
  document.addEventListener('click', closeAccountMenuOnOutsideClick);
  elements.confirmModal.addEventListener('click', (event) => {
    if (event.target === elements.confirmModal) {
      closeConfirmModal();
    }
  });
  elements.cancelConfirmButton.addEventListener('click', closeConfirmModal);
  elements.confirmGiftButton.addEventListener('click', reserveConfirmedGift);
  elements.keepGiftButton.addEventListener('click', closeCancelSelectionModal);
  elements.confirmCancelGiftButton.addEventListener('click', cancelSelectedGift);
  elements.cancelSelectionModal.addEventListener('click', (event) => {
    if (event.target === elements.cancelSelectionModal) closeCancelSelectionModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeConfirmModal();
      closeCancelSelectionModal();
    }
  });
}

async function loadGifts() {
  try {
    const response = await fetch('./gifts.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Gift catalog request failed: ${response.status}`);
    }

    state.gifts = await response.json();
    state.giftsLoaded = true;
  } catch (error) {
    state.giftsLoaded = true;
    showBanner('Не удалось загрузить список подарков. Обновите страницу чуть позже.');
    console.error(error);
  }
}

async function setupFirebase() {
  if (!firebaseSettings.isConfigured) {
    state.reservationsLoaded = true;
    state.reservationsFailed = true;
    showBanner('Firebase еще не настроен. Каталог работает в режиме просмотра, покупка станет доступна после настройки.');
    return;
  }

  try {
    const [{ initializeApp }, firestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseSettings.config);

    state.firebaseApi = firestoreApi;
    state.firestore = firestoreApi.getFirestore(app);
    state.firebaseReady = true;
    subscribeToReservations();
  } catch (error) {
    state.reservationsLoaded = true;
    state.reservationsFailed = true;
    showBanner('Не удалось подключиться к Firebase. Доступность подарков временно не обновляется.');
    console.error(error);
  }
}

function showLocalFileHint() {
  if (location.protocol === 'file:') {
    showBanner('Страница открыта как файл. Для полного локального предпросмотра запустите: python3 -m http.server 4173 и откройте http://localhost:4173');
  }
}

function subscribeToReservations() {
  const { collection, onSnapshot } = state.firebaseApi;

  onSnapshot(
    collection(state.firestore, 'reservations'),
    (snapshot) => {
      state.reservations = new Map(snapshot.docs.map((reservationDoc) => [reservationDoc.id, reservationDoc.data()]));
      state.reservationsLoaded = true;
      state.reservationsFailed = false;
      renderGifts();
      renderSelectedGifts();
    },
    (error) => {
      state.reservationsLoaded = true;
      state.reservationsFailed = true;
      showBanner('Не удалось получить занятые подарки. Попробуйте обновить страницу.');
      renderGifts();
      renderSelectedGifts();
      console.error(error);
    }
  );
}

async function handlePhoneLogin(event) {
  event.preventDefault();

  const phone = normalizePhone(elements.phoneNumber.value);
  if (phone.length < 7) {
    showToast('Введите номер телефона полностью.');
    return;
  }

  if (!state.firebaseReady) {
    showToast('Подключение к Firebase еще не готово. Попробуйте обновить страницу.');
    return;
  }

  try {
    state.pendingLogin = true;
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = 'Ищем вас...';
    state.phone = phone;
    localStorage.setItem(STORAGE_PHONE_KEY, phone);
    await loadUserByPhone(phone);
    render();
  } catch (error) {
    showToast('Не получилось войти. Попробуйте еще раз.');
    console.error(error);
  } finally {
    state.pendingLogin = false;
    elements.loginButton.disabled = false;
    elements.loginButton.textContent = 'Войти к списку';
  }
}

async function loadUserByPhone(phone) {
  const { doc, getDoc } = state.firebaseApi;
  const userSnapshot = await getDoc(doc(state.firestore, 'users', phone));

  if (!userSnapshot.exists()) {
    state.profile = null;
    state.pendingPhone = phone;
    return;
  }

  state.pendingPhone = null;
  state.profile = normalizeUser(userSnapshot.data());
  localStorage.setItem(STORAGE_PHONE_KEY, phone);
}

async function createUserProfile(event) {
  event.preventDefault();

  if (!state.pendingPhone || !state.firebaseReady) {
    return;
  }

  const firstName = elements.registerFirstName.value.trim();
  const lastName = elements.registerLastName.value.trim();

  if (firstName.length < 2 || lastName.length < 2) {
    showToast('Введите имя и фамилию полностью.');
    return;
  }

  const { doc, serverTimestamp, setDoc } = state.firebaseApi;
  const profile = {
    phone: state.pendingPhone,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    selectedGiftId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    state.pendingProfile = true;
    elements.registerButton.disabled = true;
    elements.registerButton.textContent = 'Сохраняем...';
    await setDoc(doc(state.firestore, 'users', state.pendingPhone), profile);
    state.profile = normalizeUser(profile);
    state.phone = state.pendingPhone;
    state.pendingPhone = null;
    localStorage.setItem(STORAGE_PHONE_KEY, state.phone);
    showToast('Профиль сохранен.');
    render();
  } catch (error) {
    showToast('Не получилось сохранить профиль. Попробуйте еще раз.');
    console.error(error);
  } finally {
    state.pendingProfile = false;
    elements.registerButton.disabled = false;
    elements.registerButton.textContent = 'Сохранить и открыть список';
  }
}

function normalizeUser(user) {
  return {
    phone: user.phone || state.phone || state.pendingPhone,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim()
  };
}

function normalizePhone(value) {
  return String(value).replace(/\D/g, '');
}

function clearProfile() {
  localStorage.removeItem(STORAGE_PHONE_KEY);
  state.phone = null;
  state.pendingPhone = null;
  state.profile = null;
  elements.phoneNumber.value = '';
  closeConfirmModal();
  closeCancelSelectionModal();
  render();
}

function render() {
  elements.bootView.classList.toggle('hidden', !state.booting);

  if (state.booting) {
    elements.accountMenu.classList.add('hidden');
    elements.loginView.classList.add('hidden');
    elements.registerView.classList.add('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  if (state.pendingPhone && !state.profile) {
    elements.accountMenu.classList.add('hidden');
    elements.loginView.classList.add('hidden');
    elements.registerView.classList.remove('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  if (!state.profile) {
    elements.accountMenu.classList.add('hidden');
    elements.loginView.classList.remove('hidden');
    elements.registerView.classList.add('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  elements.loginView.classList.add('hidden');
  elements.registerView.classList.add('hidden');
  elements.catalogView.classList.remove('hidden');
  elements.profileName.textContent = state.profile.displayName;
  elements.accountInitials.textContent = getInitials(state.profile.displayName);
  elements.accountMenu.classList.remove('hidden');
  renderSelectedGifts();
  renderGifts();
}

function toggleAccountMenu(event) {
  event.stopPropagation();
  const isHidden = elements.accountDropdown.classList.toggle('hidden');
  elements.accountTrigger.setAttribute('aria-expanded', String(!isHidden));
}

function closeAccountMenuOnOutsideClick(event) {
  if (!elements.accountMenu.contains(event.target)) {
    elements.accountDropdown.classList.add('hidden');
    elements.accountTrigger.setAttribute('aria-expanded', 'false');
  }
}

function getInitials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

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

function openMarketLink(gift) {
  window.open(gift.marketUrl, '_blank', 'noopener,noreferrer');
}

function shouldShowSkeleton() {
  return !state.giftsLoaded || (firebaseSettings.isConfigured && !state.reservationsLoaded);
}

function renderSkeletonCards() {
  for (let index = 0; index < 8; index += 1) {
    const card = document.createElement('article');
    card.className = 'gift-card skeleton-card';
    card.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="gift-body">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
    `;
    elements.giftGrid.append(card);
  }
}

function openConfirmModal(gift) {
  if (!gift || !state.profile || !state.firestore) {
    return;
  }

  state.confirmGift = gift;
  elements.confirmText.textContent = `Подтвердите, что ${state.profile.displayName} хочет купить этот подарок.`;
  elements.confirmPreview.innerHTML = `
    <img src="${escapeAttribute(state.confirmGift.imageUrl)}" alt="${escapeAttribute(state.confirmGift.title)}">
    <div>
      <strong>${escapeHtml(state.confirmGift.title)}</strong>
      <span>${escapeHtml(state.confirmGift.description)}</span>
    </div>
  `;
  elements.confirmGiftButton.disabled = false;
  elements.confirmGiftButton.textContent = 'Да, я хочу купить';
  elements.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  if (state.pendingReservation) {
    return;
  }

  elements.confirmModal.classList.add('hidden');
  state.confirmGift = null;
}

async function reserveConfirmedGift() {
  if (!state.confirmGift || !state.profile || !state.firestore) {
    return;
  }

  const { doc, serverTimestamp, setDoc } = state.firebaseApi;

  try {
    state.pendingReservation = true;
    elements.confirmGiftButton.disabled = true;
    elements.confirmGiftButton.textContent = 'Закрепляем...';

    await setDoc(doc(state.firestore, 'reservations', state.confirmGift.id), {
      phone: state.profile.phone,
      giftId: state.confirmGift.id,
      firstName: state.profile.firstName,
      lastName: state.profile.lastName,
      displayName: state.profile.displayName,
      createdAt: serverTimestamp()
    });

    showToast('Готово! Подарок закреплен за вами.');
    elements.confirmModal.classList.add('hidden');
    state.confirmGift = null;
    renderSelectedGifts();
    renderGifts();
  } catch (error) {
    showToast('Не получилось закрепить подарок. Возможно, его уже выбрали.');
    console.error(error);
  } finally {
    state.pendingReservation = false;
    elements.confirmGiftButton.disabled = false;
    elements.confirmGiftButton.textContent = 'Да, я хочу купить';
  }
}

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
  if (state.pendingCancel) {
    return;
  }

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
      if (error.reservation) state.reservations.set(gift.id, error.reservation);
      else state.reservations.delete(gift.id);
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

function showBanner(message) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.remove('hidden');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 4200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
