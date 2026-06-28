const STORAGE_PROFILE_KEY = 'babyGiftRegistry.profile';
const STORAGE_SELECTION_KEY = 'babyGiftRegistry.selection';
const firebaseSettings = window.giftRegistryFirebase || { config: {}, isConfigured: false };

const state = {
  booting: true,
  profile: null,
  selectedGiftId: localStorage.getItem(STORAGE_SELECTION_KEY),
  giftsLoaded: false,
  reservationsLoaded: false,
  reservationsFailed: false,
  gifts: [],
  reservations: new Map(),
  activeGift: null,
  confirmGift: null,
  pendingReservation: false,
  firestore: null,
  firebaseReady: false,
  firebaseApi: null
};

const elements = {
  bootView: document.querySelector('#bootView'),
  loginView: document.querySelector('#loginView'),
  catalogView: document.querySelector('#catalogView'),
  loginForm: document.querySelector('#loginForm'),
  firstName: document.querySelector('#firstName'),
  lastName: document.querySelector('#lastName'),
  profileName: document.querySelector('#profileName'),
  changeProfileButton: document.querySelector('#changeProfileButton'),
  statusBanner: document.querySelector('#statusBanner'),
  selectedGiftSection: document.querySelector('#selectedGiftSection'),
  giftGrid: document.querySelector('#giftGrid'),
  giftModal: document.querySelector('#giftModal'),
  modalCloseButton: document.querySelector('#modalCloseButton'),
  modalImage: document.querySelector('#modalImage'),
  modalCategory: document.querySelector('#modalCategory'),
  modalTitle: document.querySelector('#modalTitle'),
  modalPrice: document.querySelector('#modalPrice'),
  modalDescription: document.querySelector('#modalDescription'),
  modalDetails: document.querySelector('#modalDetails'),
  modalMarketLink: document.querySelector('#modalMarketLink'),
  reserveButton: document.querySelector('#reserveButton'),
  modalNote: document.querySelector('#modalNote'),
  confirmModal: document.querySelector('#confirmModal'),
  confirmText: document.querySelector('#confirmText'),
  confirmPreview: document.querySelector('#confirmPreview'),
  cancelConfirmButton: document.querySelector('#cancelConfirmButton'),
  confirmGiftButton: document.querySelector('#confirmGiftButton'),
  toast: document.querySelector('#toast')
};

init();

async function init() {
  bindEvents();
  restoreProfile();
  state.booting = false;
  render();

  await loadGifts();
  render();

  await setupFirebase();
  showLocalFileHint();
  render();
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.changeProfileButton.addEventListener('click', clearProfile);
  elements.modalCloseButton.addEventListener('click', closeModal);
  elements.giftModal.addEventListener('click', (event) => {
    if (event.target === elements.giftModal) {
      closeModal();
    }
  });
  elements.reserveButton.addEventListener('click', openConfirmModal);
  elements.confirmModal.addEventListener('click', (event) => {
    if (event.target === elements.confirmModal) {
      closeConfirmModal();
    }
  });
  elements.cancelConfirmButton.addEventListener('click', closeConfirmModal);
  elements.confirmGiftButton.addEventListener('click', reserveConfirmedGift);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeConfirmModal();
    }
  });
}

function restoreProfile() {
  const rawProfile = localStorage.getItem(STORAGE_PROFILE_KEY);

  if (!rawProfile) {
    return;
  }

  try {
    const profile = JSON.parse(rawProfile);
    if (profile.firstName && profile.lastName) {
      state.profile = profile;
    }
  } catch {
    localStorage.removeItem(STORAGE_PROFILE_KEY);
  }
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
    showBanner('Firebase еще не настроен. Каталог работает в режиме просмотра, бронирование станет доступно после настройки.');
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
      syncLocalSelection();
      renderGifts();
      renderSelectedGift();
      updateActiveModalState();
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

function syncLocalSelection() {
  if (!state.selectedGiftId || !state.reservationsLoaded || state.reservationsFailed) {
    return;
  }

  const reservation = state.reservations.get(state.selectedGiftId);
  if (!reservation) {
    state.selectedGiftId = null;
    localStorage.removeItem(STORAGE_SELECTION_KEY);
  }
}

function handleLogin(event) {
  event.preventDefault();

  const firstName = elements.firstName.value.trim();
  const lastName = elements.lastName.value.trim();

  if (firstName.length < 2 || lastName.length < 2) {
    showToast('Введите имя и фамилию полностью.');
    return;
  }

  state.profile = {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`
  };

  localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(state.profile));
  render();
}

function clearProfile() {
  localStorage.removeItem(STORAGE_PROFILE_KEY);
  state.profile = null;
  closeModal();
  closeConfirmModal();
  render();
}

function render() {
  elements.bootView.classList.toggle('hidden', !state.booting);

  if (state.booting) {
    elements.loginView.classList.add('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  if (!state.profile) {
    elements.loginView.classList.remove('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  elements.loginView.classList.add('hidden');
  elements.catalogView.classList.remove('hidden');
  elements.profileName.textContent = state.profile.displayName;
  renderSelectedGift();
  renderGifts();
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
      <p class="eyebrow">Ваш подарок выбран</p>
      <h2 id="selectedGiftTitle">${escapeHtml(selectedGift.title)}</h2>
      <p>${escapeHtml(selectedGift.description)}</p>
      <div class="selected-meta">
        <span>${escapeHtml(selectedGift.category)}</span>
        <strong>${escapeHtml(selectedGift.price)}</strong>
      </div>
      <a class="market-link" href="${escapeAttribute(selectedGift.marketUrl)}" target="_blank" rel="noreferrer">Открыть на маркетплейсе</a>
    </div>
    <img src="${escapeAttribute(selectedGift.imageUrl)}" alt="${escapeAttribute(selectedGift.title)}">
  `;
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
    const userAlreadySelected = Boolean(state.selectedGiftId);
    const isOwnSelection = state.selectedGiftId === gift.id && isReserved;
    const card = document.createElement('article');

    card.className = `gift-card${isReserved ? ' reserved' : ''}${isOwnSelection ? ' own-gift' : ''}`;
    card.innerHTML = `
      <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}" loading="lazy">
      <div class="gift-body">
        <div class="gift-topline">
          <span>${escapeHtml(gift.category)}</span>
          <span>${escapeHtml(gift.price)}</span>
        </div>
        <h2>${escapeHtml(gift.title)}</h2>
        <p>${escapeHtml(gift.description)}</p>
        <p>${getAvailabilityText(isReserved, reservation, isOwnSelection)}</p>
        <button class="gift-action" type="button" ${isGiftActionDisabled(isReserved, isOwnSelection, userAlreadySelected) ? 'disabled' : ''}>
          ${getActionText(isReserved, isOwnSelection, userAlreadySelected)}
        </button>
      </div>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', () => openModal(gift));
    elements.giftGrid.append(card);
  }
}

function shouldShowSkeleton() {
  return !state.giftsLoaded || (firebaseSettings.isConfigured && !state.reservationsLoaded);
}

function renderSkeletonCards() {
  for (let index = 0; index < 6; index += 1) {
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

function isGiftActionDisabled(isReserved, isOwnSelection, userAlreadySelected) {
  return !state.firebaseReady || state.reservationsFailed || isReserved || (userAlreadySelected && !isOwnSelection);
}

function getConfirmedSelectedGift() {
  if (!state.selectedGiftId || !state.reservationsLoaded || state.reservationsFailed) {
    return null;
  }

  const reservation = state.reservations.get(state.selectedGiftId);
  if (!reservation) {
    return null;
  }

  return state.gifts.find((gift) => gift.id === state.selectedGiftId) || null;
}

function getAvailabilityText(isReserved, reservation, isOwnSelection) {
  if (isOwnSelection) {
    return 'Ваш подарок уже закреплен.';
  }

  if (isReserved) {
    return `Уже дарит ${reservation.displayName}.`;
  }

  if (!state.firebaseReady || state.reservationsFailed) {
    return 'Бронирование временно недоступно.';
  }

  if (state.selectedGiftId) {
    return 'Вы уже выбрали один подарок.';
  }

  return 'Свободен для выбора.';
}

function getActionText(isReserved, isOwnSelection, userAlreadySelected) {
  if (isOwnSelection) {
    return 'Ваш подарок';
  }

  if (isReserved) {
    return 'Уже занят';
  }

  if (userAlreadySelected) {
    return 'Можно выбрать только один';
  }

  if (!state.firebaseReady || state.reservationsFailed) {
    return 'Загрузка статуса';
  }

  return 'Посмотреть';
}

function openModal(gift) {
  state.activeGift = gift;
  elements.modalImage.src = gift.imageUrl;
  elements.modalImage.alt = gift.title;
  elements.modalCategory.textContent = gift.category;
  elements.modalTitle.textContent = gift.title;
  elements.modalPrice.textContent = gift.price;
  elements.modalDescription.textContent = gift.description;
  elements.modalDetails.textContent = gift.details;
  elements.modalMarketLink.href = gift.marketUrl;
  elements.giftModal.classList.remove('hidden');
  updateActiveModalState();
}

function closeModal() {
  elements.giftModal.classList.add('hidden');
  state.activeGift = null;
}

function updateActiveModalState() {
  if (!state.activeGift) {
    return;
  }

  const reservation = state.reservations.get(state.activeGift.id);
  const isReserved = Boolean(reservation);
  const isOwnSelection = state.selectedGiftId === state.activeGift.id && isReserved;
  const hasOtherSelection = Boolean(state.selectedGiftId) && !isOwnSelection;

  elements.reserveButton.disabled = isReserved || hasOtherSelection || !state.firebaseReady || state.reservationsFailed;

  if (!state.firebaseReady || state.reservationsFailed) {
    elements.modalNote.textContent = 'Бронирование станет доступно после загрузки статуса подарков.';
    return;
  }

  if (isOwnSelection) {
    elements.modalNote.textContent = 'Вы уже выбрали этот подарок.';
    return;
  }

  if (isReserved) {
    elements.modalNote.textContent = `Этот подарок уже дарит ${reservation.displayName}.`;
    return;
  }

  if (hasOtherSelection) {
    elements.modalNote.textContent = 'Вы уже выбрали один подарок. Перевыбор отключен.';
    return;
  }

  elements.modalNote.textContent = 'После подтверждения подарок станет недоступен для остальных гостей.';
}

function openConfirmModal() {
  if (!state.activeGift || !state.profile || !state.firestore) {
    return;
  }

  state.confirmGift = state.activeGift;
  elements.confirmText.textContent = `Подтвердите, что ${state.profile.displayName} будет дарить этот подарок.`;
  elements.confirmPreview.innerHTML = `
    <img src="${escapeAttribute(state.confirmGift.imageUrl)}" alt="${escapeAttribute(state.confirmGift.title)}">
    <div>
      <strong>${escapeHtml(state.confirmGift.title)}</strong>
      <span>${escapeHtml(state.confirmGift.price)}</span>
    </div>
  `;
  elements.confirmGiftButton.disabled = false;
  elements.confirmGiftButton.textContent = 'Да, это мой подарок';
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
      giftId: state.confirmGift.id,
      firstName: state.profile.firstName,
      lastName: state.profile.lastName,
      displayName: state.profile.displayName,
      createdAt: serverTimestamp()
    });

    state.selectedGiftId = state.confirmGift.id;
    localStorage.setItem(STORAGE_SELECTION_KEY, state.confirmGift.id);
    showToast('Готово! Подарок закреплен за вами.');
    closeModal();
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
    elements.confirmGiftButton.textContent = 'Да, это мой подарок';
    if (state.activeGift) {
      updateActiveModalState();
    }
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
