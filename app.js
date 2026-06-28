const STORAGE_PHONE_KEY = 'babyGiftRegistry.phone';
const firebaseSettings = window.giftRegistryFirebase || { config: {}, isConfigured: false };

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
  switchGift: null,
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
  giftGrid: document.querySelector('#giftGrid'),
  confirmModal: document.querySelector('#confirmModal'),
  confirmText: document.querySelector('#confirmText'),
  confirmPreview: document.querySelector('#confirmPreview'),
  cancelConfirmButton: document.querySelector('#cancelConfirmButton'),
  confirmGiftButton: document.querySelector('#confirmGiftButton'),
  switchChoiceModal: document.querySelector('#switchChoiceModal'),
  switchChoiceText: document.querySelector('#switchChoiceText'),
  switchChoicePreview: document.querySelector('#switchChoicePreview'),
  keepCurrentGiftButton: document.querySelector('#keepCurrentGiftButton'),
  goToCancelGiftButton: document.querySelector('#goToCancelGiftButton'),
  cancelSelectionModal: document.querySelector('#cancelSelectionModal'),
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
  elements.switchChoiceModal.addEventListener('click', (event) => {
    if (event.target === elements.switchChoiceModal) {
      closeSwitchChoiceModal();
    }
  });
  elements.keepCurrentGiftButton.addEventListener('click', closeSwitchChoiceModal);
  elements.goToCancelGiftButton.addEventListener('click', moveFromSwitchToCancel);
  elements.keepGiftButton.addEventListener('click', closeCancelSelectionModal);
  elements.confirmCancelGiftButton.addEventListener('click', cancelSelectedGift);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeConfirmModal();
      closeSwitchChoiceModal();
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
      syncSelectedGift();
      renderGifts();
      renderSelectedGift();
    },
    (error) => {
      state.reservationsLoaded = true;
      state.reservationsFailed = true;
      showBanner('Не удалось получить занятые подарки. Попробуйте обновить страницу.');
      renderGifts();
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
  syncSelectedGift();
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
    displayName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    selectedGiftId: user.selectedGiftId || ''
  };
}

function normalizePhone(value) {
  return String(value).replace(/\D/g, '');
}

function syncSelectedGift() {
  if (!state.profile || !state.profile.selectedGiftId || !state.reservationsLoaded || state.reservationsFailed) {
    return;
  }

  const reservation = state.reservations.get(state.profile.selectedGiftId);
  if (!reservation || reservation.phone !== state.profile.phone) {
    state.profile.selectedGiftId = '';
  }
}

function clearProfile() {
  localStorage.removeItem(STORAGE_PHONE_KEY);
  state.phone = null;
  state.pendingPhone = null;
  state.profile = null;
  elements.phoneNumber.value = '';
  closeConfirmModal();
  closeSwitchChoiceModal();
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
  renderSelectedGift();
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

function renderSelectedGift() {
  const selectedGift = getConfirmedSelectedGift();

  if (!selectedGift) {
    elements.selectedGiftSection.classList.add('hidden');
    elements.selectedGiftSection.innerHTML = '';
    return;
  }

  elements.selectedGiftSection.classList.remove('hidden');
  elements.selectedGiftSection.innerHTML = `
    <div class="selected-copy">
      <p class="eyebrow">Вы выбрали подарок</p>
      <h2 id="selectedGiftTitle">${escapeHtml(selectedGift.title)}</h2>
      <div class="selected-meta">
        <span>${escapeHtml(selectedGift.category)}</span>
      </div>
      <a class="market-link" href="${escapeAttribute(selectedGift.marketUrl)}" target="_blank" rel="noreferrer">Где его купить</a>
      <p>${escapeHtml(selectedGift.description)}</p>
    </div>
    <img src="${escapeAttribute(selectedGift.imageUrl)}" alt="${escapeAttribute(selectedGift.title)}">
    <div class="cancel-gift-panel">
      <p>Если вы решили купить другой подарок, сначала откажитесь от текущего. После отказа подарок снова станет доступен другим гостям.</p>
      <button class="soft-danger-action" id="cancelGiftButton" type="button">Отказаться от подарка</button>
    </div>
  `;

  document.querySelector('#cancelGiftButton').addEventListener('click', openCancelSelectionModal);
}

function renderGifts() {
  elements.giftGrid.innerHTML = '';

  if (shouldShowSkeleton()) {
    renderSkeletonCards();
    return;
  }

  if (state.gifts.length === 0) {
    elements.giftGrid.innerHTML = '<p class="status-banner">Пока список подарков пуст.</p>';
    return;
  }

  for (const gift of state.gifts) {
    const reservation = state.reservations.get(gift.id);
    const isReserved = Boolean(reservation);
    const userAlreadySelected = Boolean(state.profile?.selectedGiftId);
    const isOwnSelection = state.profile?.selectedGiftId === gift.id && isReserved;
    const card = document.createElement('article');

    card.className = `gift-card${isReserved ? ' reserved' : ''}${isOwnSelection ? ' own-gift' : ''}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Открыть магазин: ${gift.title}`);
    card.innerHTML = `
      <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}" loading="lazy">
      <div class="gift-body">
        <div class="gift-topline">
          <span>${escapeHtml(gift.category)}</span>
        </div>
        <h2>${escapeHtml(gift.title)}</h2>
        <p>${escapeHtml(gift.description)}</p>
        ${getAvailabilityText(isReserved, reservation, isOwnSelection) ? `<p>${getAvailabilityText(isReserved, reservation, isOwnSelection)}</p>` : ''}
        <button class="gift-action" type="button" ${isGiftActionDisabled(isReserved, isOwnSelection, userAlreadySelected) ? 'disabled' : ''}>
          ${getActionText(isReserved, isOwnSelection, userAlreadySelected)}
        </button>
      </div>
    `;

    const button = card.querySelector('button');
    card.addEventListener('click', () => openMarketLink(gift));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        openMarketLink(gift);
      }
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (userAlreadySelected && !isOwnSelection && !isReserved) {
        openSwitchChoiceModal(gift);
        return;
      }

      openConfirmModal(gift);
    });
    elements.giftGrid.append(card);
  }
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

function isGiftActionDisabled(isReserved) {
  return !state.firebaseReady || state.reservationsFailed || isReserved;
}

function getConfirmedSelectedGift() {
  if (!state.profile?.selectedGiftId || !state.reservationsLoaded || state.reservationsFailed) {
    return null;
  }

  const reservation = state.reservations.get(state.profile.selectedGiftId);
  if (!reservation || reservation.phone !== state.profile.phone) {
    return null;
  }

  return state.gifts.find((gift) => gift.id === state.profile.selectedGiftId) || null;
}

function getAvailabilityText(isReserved, reservation, isOwnSelection) {
  if (isOwnSelection) {
    return 'Вы покупаете этот подарок.';
  }

  if (isReserved) {
    return `Уже покупает ${reservation.displayName}.`;
  }

  if (!state.firebaseReady || state.reservationsFailed) {
    return 'Покупка временно недоступна.';
  }

  if (state.profile?.selectedGiftId) {
    return 'Вы уже выбрали один подарок для покупки.';
  }

  return '';
}

function getActionText(isReserved, isOwnSelection, userAlreadySelected) {
  if (isOwnSelection) {
    return 'Ваш подарок';
  }

  if (isReserved) {
    return 'Уже купят';
  }

  if (!state.firebaseReady || state.reservationsFailed) {
    return 'Загрузка статуса';
  }

  return 'Я хочу купить';
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

function openSwitchChoiceModal(gift) {
  const selectedGift = getConfirmedSelectedGift();

  if (!gift || !selectedGift) {
    return;
  }

  state.switchGift = gift;
  elements.switchChoiceText.textContent = `Сейчас за вами закреплен подарок «${selectedGift.title}». Если вы хотите выбрать «${gift.title}», сначала нужно отказаться от текущего подарка. После отказа он снова станет доступен другим гостям, а новый подарок нужно будет подтвердить отдельным нажатием.`;
  elements.switchChoicePreview.innerHTML = `
    <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}">
    <div>
      <strong>${escapeHtml(gift.title)}</strong>
      <span>${escapeHtml(gift.description)}</span>
    </div>
  `;
  elements.switchChoiceModal.classList.remove('hidden');
}

function closeSwitchChoiceModal() {
  elements.switchChoiceModal.classList.add('hidden');
  state.switchGift = null;
}

function moveFromSwitchToCancel() {
  closeSwitchChoiceModal();
  openCancelSelectionModal();
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

    await setDoc(doc(state.firestore, 'users', state.profile.phone), {
      selectedGiftId: state.confirmGift.id,
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.profile.selectedGiftId = state.confirmGift.id;
    showToast('Готово! Подарок закреплен за вами.');
    elements.confirmModal.classList.add('hidden');
    state.confirmGift = null;
    renderSelectedGift();
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

function openCancelSelectionModal() {
  if (!getConfirmedSelectedGift()) {
    return;
  }

  elements.cancelSelectionModal.classList.remove('hidden');
}

function closeCancelSelectionModal() {
  if (state.pendingCancel) {
    return;
  }

  elements.cancelSelectionModal.classList.add('hidden');
}

async function cancelSelectedGift() {
  const selectedGift = getConfirmedSelectedGift();
  if (!selectedGift || !state.profile || !state.firestore) {
    return;
  }

  const { deleteDoc, doc, serverTimestamp, setDoc } = state.firebaseApi;

  try {
    state.pendingCancel = true;
    elements.confirmCancelGiftButton.disabled = true;
    elements.confirmCancelGiftButton.textContent = 'Отказываемся...';

    await deleteDoc(doc(state.firestore, 'reservations', selectedGift.id));
    await setDoc(doc(state.firestore, 'users', state.profile.phone), {
      selectedGiftId: '',
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.profile.selectedGiftId = '';
    elements.cancelSelectionModal.classList.add('hidden');
    showToast('Вы отказались от подарка. Теперь можно выбрать другой.');
    renderSelectedGift();
    renderGifts();
  } catch (error) {
    showToast('Не получилось отказаться от подарка. Попробуйте еще раз.');
    console.error(error);
  } finally {
    state.pendingCancel = false;
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
