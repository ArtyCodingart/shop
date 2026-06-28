import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const STORAGE_PROFILE_KEY = 'babyGiftRegistry.profile';
const STORAGE_SELECTION_KEY = 'babyGiftRegistry.selection';

const state = {
  profile: null,
  selectedGiftId: localStorage.getItem(STORAGE_SELECTION_KEY),
  gifts: [],
  reservations: new Map(),
  activeGift: null,
  firestore: null,
  firebaseReady: false,
  firebaseApi: null
};

const elements = {
  loginView: document.querySelector('#loginView'),
  catalogView: document.querySelector('#catalogView'),
  loginForm: document.querySelector('#loginForm'),
  firstName: document.querySelector('#firstName'),
  lastName: document.querySelector('#lastName'),
  profileName: document.querySelector('#profileName'),
  changeProfileButton: document.querySelector('#changeProfileButton'),
  statusBanner: document.querySelector('#statusBanner'),
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
  toast: document.querySelector('#toast')
};

init();

async function init() {
  bindEvents();
  restoreProfile();
  await loadGifts();
  await setupFirebase();
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
  elements.reserveButton.addEventListener('click', reserveActiveGift);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
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
  } catch (error) {
    showBanner('Не удалось загрузить список подарков. Обновите страницу чуть позже.');
    console.error(error);
  }
}

async function setupFirebase() {
  if (!isFirebaseConfigured) {
    showBanner('Firebase еще не настроен. Каталог работает в режиме просмотра, бронирование станет доступно после настройки.');
    return;
  }

  try {
    const [{ initializeApp }, firestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseConfig);

    state.firebaseApi = firestoreApi;
    state.firestore = firestoreApi.getFirestore(app);
    state.firebaseReady = true;
    subscribeToReservations();
  } catch (error) {
    showBanner('Не удалось подключиться к Firebase. Доступность подарков временно не обновляется.');
    console.error(error);
  }
}

function subscribeToReservations() {
  const { collection, onSnapshot } = state.firebaseApi;

  onSnapshot(
    collection(state.firestore, 'reservations'),
    (snapshot) => {
      state.reservations = new Map(snapshot.docs.map((reservationDoc) => [reservationDoc.id, reservationDoc.data()]));
      renderGifts();
      updateActiveModalState();
    },
    (error) => {
      showBanner('Не удалось получить занятые подарки. Попробуйте обновить страницу.');
      console.error(error);
    }
  );
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
  render();
}

function render() {
  if (!state.profile) {
    elements.loginView.classList.remove('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  elements.loginView.classList.add('hidden');
  elements.catalogView.classList.remove('hidden');
  elements.profileName.textContent = state.profile.displayName;
  renderGifts();
}

function renderGifts() {
  elements.giftGrid.innerHTML = '';

  if (state.gifts.length === 0) {
    elements.giftGrid.innerHTML = '<p class="status-banner">Пока список подарков пуст.</p>';
    return;
  }

  for (const gift of state.gifts) {
    const reservation = state.reservations.get(gift.id);
    const isReserved = Boolean(reservation);
    const userAlreadySelected = Boolean(state.selectedGiftId);
    const isOwnSelection = state.selectedGiftId === gift.id;
    const card = document.createElement('article');

    card.className = `gift-card${isReserved ? ' reserved' : ''}`;
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
        <button class="gift-action" type="button" ${isReserved || (userAlreadySelected && !isOwnSelection) ? 'disabled' : ''}>
          ${getActionText(isReserved, isOwnSelection, userAlreadySelected)}
        </button>
      </div>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', () => openModal(gift));
    elements.giftGrid.append(card);
  }
}

function getAvailabilityText(isReserved, reservation, isOwnSelection) {
  if (isReserved && isOwnSelection) {
    return 'Это ваш выбранный подарок.';
  }

  if (isReserved) {
    return `Уже дарит ${reservation.displayName}.`;
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
  const isOwnSelection = state.selectedGiftId === state.activeGift.id;
  const hasOtherSelection = Boolean(state.selectedGiftId) && !isOwnSelection;

  elements.reserveButton.disabled = isReserved || hasOtherSelection || !state.firebaseReady;

  if (!state.firebaseReady) {
    elements.modalNote.textContent = 'Бронирование станет доступно после настройки Firebase.';
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
    elements.modalNote.textContent = 'Вы уже выбрали один подарок. Чтобы выбрать другой, понадобится очистить выбор вручную в браузере.';
    return;
  }

  elements.modalNote.textContent = 'После подтверждения подарок станет недоступен для остальных гостей.';
}

async function reserveActiveGift() {
  if (!state.activeGift || !state.profile || !state.firestore) {
    return;
  }

  if (!window.confirm('Вы точно уверены, что хотите подарить этот подарок?')) {
    return;
  }

  const { doc, serverTimestamp, setDoc } = state.firebaseApi;

  try {
    elements.reserveButton.disabled = true;
    await setDoc(doc(state.firestore, 'reservations', state.activeGift.id), {
      giftId: state.activeGift.id,
      firstName: state.profile.firstName,
      lastName: state.profile.lastName,
      displayName: state.profile.displayName,
      createdAt: serverTimestamp()
    });

    state.selectedGiftId = state.activeGift.id;
    localStorage.setItem(STORAGE_SELECTION_KEY, state.activeGift.id);
    showToast('Готово! Подарок закреплен за вами.');
    closeModal();
    renderGifts();
  } catch (error) {
    showToast('Не получилось закрепить подарок. Возможно, его уже выбрали.');
    console.error(error);
  } finally {
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
