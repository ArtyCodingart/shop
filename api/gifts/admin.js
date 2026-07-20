import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const ADMIN_EMAIL = 'arty.codingart@gmail.com';
const GIFT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const firebaseSettings = window.giftRegistryFirebase || { config: {}, isConfigured: false };

const elements = {
  loginView: document.querySelector('#adminLoginView'),
  loginForm: document.querySelector('#adminLoginForm'),
  email: document.querySelector('#adminEmail'),
  password: document.querySelector('#adminPassword'),
  loginButton: document.querySelector('#adminLoginButton'),
  loginStatus: document.querySelector('#adminLoginStatus'),
  adminView: document.querySelector('#adminView'),
  adminIdentity: document.querySelector('#adminIdentity'),
  logoutButton: document.querySelector('#logoutAdminButton'),
  addGiftButton: document.querySelector('#addGiftButton'),
  giftCount: document.querySelector('#giftCount'),
  adminStatus: document.querySelector('#adminStatus'),
  giftList: document.querySelector('#adminGiftList'),
  giftDialog: document.querySelector('#giftDialog'),
  giftDialogTitle: document.querySelector('#giftDialogTitle'),
  giftForm: document.querySelector('#giftForm'),
  closeGiftDialogButton: document.querySelector('#closeGiftDialogButton'),
  cancelGiftFormButton: document.querySelector('#cancelGiftFormButton'),
  saveGiftButton: document.querySelector('#saveGiftButton'),
  giftId: document.querySelector('#giftId'),
  giftTitle: document.querySelector('#giftTitle'),
  giftCategory: document.querySelector('#giftCategory'),
  giftPrice: document.querySelector('#giftPrice'),
  giftDescription: document.querySelector('#giftDescription'),
  giftDetails: document.querySelector('#giftDetails'),
  giftMarketUrl: document.querySelector('#giftMarketUrl'),
  giftImageUrl: document.querySelector('#giftImageUrl'),
  giftImagePreviewWrap: document.querySelector('#giftImagePreviewWrap'),
  giftImagePreview: document.querySelector('#giftImagePreview'),
  giftFormStatus: document.querySelector('#giftFormStatus'),
  deleteDialog: document.querySelector('#deleteDialog'),
  deleteDialogText: document.querySelector('#deleteDialogText'),
  deleteStatus: document.querySelector('#deleteStatus'),
  cancelDeleteButton: document.querySelector('#cancelDeleteButton'),
  confirmDeleteButton: document.querySelector('#confirmDeleteButton'),
  toast: document.querySelector('#adminToast')
};

const state = {
  auth: null,
  firestore: null,
  user: null,
  gifts: [],
  reservations: new Map(),
  editingGiftId: null,
  deletingGift: null,
  pendingLogin: false,
  pendingSave: false,
  pendingDelete: false,
  unsubscribers: []
};

init();

function init() {
  bindEvents();
  elements.email.value = ADMIN_EMAIL;

  if (!firebaseSettings.isConfigured) {
    showLoginError('Firebase не настроен. Проверьте firebase-config.js.');
    elements.loginButton.disabled = true;
    return;
  }

  try {
    const app = initializeApp(firebaseSettings.config);
    state.auth = getAuth(app);
    state.firestore = getFirestore(app);
    onAuthStateChanged(state.auth, handleAuthState);
  } catch (error) {
    showLoginError('Не удалось подключиться к Firebase. Обновите страницу.');
    console.error(error);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.addGiftButton.addEventListener('click', () => openGiftDialog());
  elements.closeGiftDialogButton.addEventListener('click', closeGiftDialog);
  elements.cancelGiftFormButton.addEventListener('click', closeGiftDialog);
  elements.giftForm.addEventListener('submit', saveGift);
  elements.giftImageUrl.addEventListener('input', updateImagePreview);
  elements.giftImagePreview.addEventListener('error', hideImagePreview);
  elements.cancelDeleteButton.addEventListener('click', closeDeleteDialog);
  elements.confirmDeleteButton.addEventListener('click', deleteGift);

  elements.giftDialog.addEventListener('cancel', (event) => {
    if (state.pendingSave) event.preventDefault();
  });
  elements.deleteDialog.addEventListener('cancel', (event) => {
    if (state.pendingDelete) event.preventDefault();
  });
}

async function handleLogin(event) {
  event.preventDefault();
  if (state.pendingLogin || !state.auth) return;

  const email = elements.email.value.trim().toLowerCase();
  const password = elements.password.value;
  clearLoginError();

  if (email !== ADMIN_EMAIL) {
    showLoginError('У этого аккаунта нет доступа.');
    elements.email.focus();
    return;
  }

  try {
    state.pendingLogin = true;
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = 'Входим…';
    await signInWithEmailAndPassword(state.auth, email, password);
    elements.password.value = '';
  } catch (error) {
    showLoginError(getAuthErrorMessage(error));
    elements.password.select();
  } finally {
    state.pendingLogin = false;
    elements.loginButton.disabled = false;
    elements.loginButton.textContent = 'Войти';
  }
}

async function handleAuthState(user) {
  clearSubscriptions();
  state.user = null;

  if (!user) {
    showLoginView();
    return;
  }

  if (String(user.email).toLowerCase() !== ADMIN_EMAIL) {
    await signOut(state.auth);
    showLoginView();
    showLoginError('У этого аккаунта нет доступа.');
    return;
  }

  state.user = user;
  showAdminView();
  subscribeAdminData();
}

async function handleLogout() {
  if (!state.auth) return;

  try {
    await signOut(state.auth);
  } catch (error) {
    showAdminStatus('Не удалось выйти. Попробуйте ещё раз.', 'error');
    console.error(error);
  }
}

function showLoginView() {
  closeGiftDialog();
  closeDeleteDialog();
  elements.adminView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.password.value = '';
}

function showAdminView() {
  clearLoginError();
  elements.loginView.classList.add('hidden');
  elements.adminView.classList.remove('hidden');
  elements.adminIdentity.textContent = state.user.email;
  showAdminStatus('Загружаем каталог…');
}

function subscribeAdminData() {
  clearSubscriptions();

  const giftsQuery = query(collection(state.firestore, 'gifts'), orderBy('sortOrder'));
  state.unsubscribers.push(
    onSnapshot(
      giftsQuery,
      (snapshot) => {
        state.gifts = snapshot.docs.map((giftDoc) => ({ ...giftDoc.data(), id: giftDoc.id }));
        renderGiftList();
        hideAdminStatus();
      },
      (error) => {
        showAdminStatus(getFirestoreErrorMessage(error, 'Не удалось загрузить подарки.'), 'error');
        console.error(error);
      }
    )
  );

  state.unsubscribers.push(
    onSnapshot(
      collection(state.firestore, 'reservations'),
      (snapshot) => {
        state.reservations = new Map(snapshot.docs.map((reservationDoc) => [reservationDoc.id, reservationDoc.data()]));
        renderGiftList();
      },
      (error) => {
        showAdminStatus('Подарки загружены, но проверить брони не удалось. Удаление временно отключено.', 'error');
        state.reservations = null;
        renderGiftList();
        console.error(error);
      }
    )
  );
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
  state.gifts = [];
  state.reservations = new Map();
  renderGiftList();
}

function renderGiftList() {
  elements.giftList.replaceChildren();
  elements.giftCount.textContent = formatGiftCount(state.gifts.length);

  if (state.gifts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = state.user ? 'В каталоге пока нет подарков.' : '';
    if (empty.textContent) elements.giftList.append(empty);
    return;
  }

  for (const gift of state.gifts) {
    elements.giftList.append(createGiftRow(gift));
  }
}

function createGiftRow(gift) {
  const reservation = state.reservations?.get(gift.id);
  const card = document.createElement('article');
  const image = document.createElement('img');
  const copy = document.createElement('div');
  const meta = document.createElement('div');
  const id = document.createElement('span');
  const category = document.createElement('span');
  const price = document.createElement('span');
  const title = document.createElement('h2');
  const description = document.createElement('p');
  const actions = document.createElement('div');
  const editButton = document.createElement('button');
  const deleteButton = document.createElement('button');

  card.className = 'admin-gift-card';
  image.src = gift.imageUrl;
  image.alt = '';
  image.loading = 'lazy';
  copy.className = 'gift-copy';
  meta.className = 'gift-meta';
  id.textContent = gift.id;
  category.textContent = gift.category;
  price.textContent = gift.price;
  title.textContent = gift.title;
  description.textContent = gift.description;
  actions.className = 'gift-actions';
  editButton.className = 'secondary-button';
  editButton.type = 'button';
  editButton.textContent = 'Изменить';
  editButton.addEventListener('click', () => openGiftDialog(gift));
  deleteButton.className = 'danger-button';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Удалить';
  deleteButton.disabled = Boolean(reservation) || state.reservations === null;
  deleteButton.addEventListener('click', () => openDeleteDialog(gift));

  meta.append(id, category, price);
  copy.append(meta, title, description);
  if (reservation) {
    const note = document.createElement('span');
    note.className = 'reservation-note';
    note.textContent = `Закреплён за: ${reservation.displayName || 'гость'}`;
    copy.append(note);
    deleteButton.title = `Сначала нужно освободить бронь: ${reservation.displayName || 'гость'}`;
  } else if (state.reservations === null) {
    deleteButton.title = 'Не удалось проверить брони';
  }

  actions.append(editButton, deleteButton);
  card.append(image, copy, actions);
  return card;
}

function openGiftDialog(gift = null) {
  if (state.pendingSave) return;

  state.editingGiftId = gift?.id || null;
  elements.giftForm.reset();
  clearGiftFormError();
  hideImagePreview();
  elements.giftDialogTitle.textContent = gift ? 'Изменить подарок' : 'Добавить подарок';
  elements.giftId.readOnly = Boolean(gift);

  if (gift) {
    elements.giftId.value = gift.id;
    elements.giftTitle.value = gift.title;
    elements.giftCategory.value = gift.category;
    elements.giftPrice.value = gift.price;
    elements.giftDescription.value = gift.description;
    elements.giftDetails.value = gift.details;
    elements.giftMarketUrl.value = gift.marketUrl;
    elements.giftImageUrl.value = gift.imageUrl;
    updateImagePreview();
  }

  elements.giftDialog.showModal();
  (gift ? elements.giftTitle : elements.giftId).focus();
}

function closeGiftDialog() {
  if (state.pendingSave || !elements.giftDialog.open) return;
  elements.giftDialog.close();
  state.editingGiftId = null;
  clearGiftFormError();
  elements.addGiftButton.focus();
}

async function saveGift(event) {
  event.preventDefault();
  if (state.pendingSave) return;

  const gift = readGiftForm();
  if (!gift) return;

  try {
    state.pendingSave = true;
    elements.saveGiftButton.disabled = true;
    elements.cancelGiftFormButton.disabled = true;
    elements.closeGiftDialogButton.disabled = true;
    elements.saveGiftButton.textContent = 'Сохраняем…';
    clearGiftFormError();

    if (state.editingGiftId) {
      await updateExistingGift(gift);
      showToast('Подарок обновлён.');
    } else {
      await createGift(gift);
      showToast('Подарок добавлен.');
    }

    elements.giftDialog.close();
    state.editingGiftId = null;
    elements.addGiftButton.focus();
  } catch (error) {
    if (error.code === 'gift-id-exists') {
      showGiftFormError('Подарок с таким ID уже существует.');
      elements.giftId.focus();
    } else {
      showGiftFormError(getFirestoreErrorMessage(error, 'Не удалось сохранить подарок.'));
      console.error(error);
    }
  } finally {
    state.pendingSave = false;
    elements.saveGiftButton.disabled = false;
    elements.cancelGiftFormButton.disabled = false;
    elements.closeGiftDialogButton.disabled = false;
    elements.saveGiftButton.textContent = 'Сохранить';
  }
}

function readGiftForm() {
  if (!elements.giftForm.reportValidity()) return null;

  const gift = {
    id: elements.giftId.value.trim(),
    title: elements.giftTitle.value.trim(),
    category: elements.giftCategory.value.trim(),
    price: elements.giftPrice.value.trim(),
    description: elements.giftDescription.value.trim(),
    details: elements.giftDetails.value.trim(),
    marketUrl: elements.giftMarketUrl.value.trim(),
    imageUrl: elements.giftImageUrl.value.trim()
  };

  if (!GIFT_ID_PATTERN.test(gift.id)) {
    showGiftFormError('ID может содержать только латинские буквы, цифры и дефисы.');
    elements.giftId.focus();
    return null;
  }

  const emptyField = [
    elements.giftTitle,
    elements.giftCategory,
    elements.giftPrice,
    elements.giftDescription,
    elements.giftDetails
  ].find((field) => !field.value.trim());
  if (emptyField) {
    showGiftFormError('Заполните все поля.');
    emptyField.focus();
    return null;
  }

  if (!isHttpUrl(gift.marketUrl)) {
    showGiftFormError('Ссылка на магазин должна начинаться с http:// или https://.');
    elements.giftMarketUrl.focus();
    return null;
  }
  if (!isHttpUrl(gift.imageUrl)) {
    showGiftFormError('Ссылка на изображение должна начинаться с http:// или https://.');
    elements.giftImageUrl.focus();
    return null;
  }

  return gift;
}

async function createGift(gift) {
  const giftRef = doc(state.firestore, 'gifts', gift.id);
  const nextSortOrder = state.gifts.reduce((maximum, current) => Math.max(maximum, Number(current.sortOrder) || 0), -1) + 1;

  await runTransaction(state.firestore, async (transaction) => {
    const snapshot = await transaction.get(giftRef);
    if (snapshot.exists()) {
      const error = new Error('Gift ID already exists');
      error.code = 'gift-id-exists';
      throw error;
    }

    transaction.set(giftRef, {
      ...gift,
      sortOrder: nextSortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
}

async function updateExistingGift(gift) {
  const giftRef = doc(state.firestore, 'gifts', state.editingGiftId);
  await updateDoc(giftRef, {
    title: gift.title,
    category: gift.category,
    price: gift.price,
    description: gift.description,
    details: gift.details,
    marketUrl: gift.marketUrl,
    imageUrl: gift.imageUrl,
    updatedAt: serverTimestamp()
  });
}

function openDeleteDialog(gift) {
  const reservation = state.reservations?.get(gift.id);
  if (reservation) {
    showToast(`Нельзя удалить: подарок закреплён за ${reservation.displayName || 'гостем'}.`);
    return;
  }
  if (state.reservations === null) {
    showToast('Удаление недоступно: не удалось проверить брони.');
    return;
  }

  state.deletingGift = gift;
  elements.deleteDialogText.textContent = `Подарок «${gift.title}» исчезнет из общего каталога.`;
  clearDeleteError();
  elements.confirmDeleteButton.disabled = false;
  elements.deleteDialog.showModal();
  elements.cancelDeleteButton.focus();
}

function closeDeleteDialog() {
  if (state.pendingDelete || !elements.deleteDialog.open) return;
  elements.deleteDialog.close();
  state.deletingGift = null;
  clearDeleteError();
}

async function deleteGift() {
  const gift = state.deletingGift;
  if (!gift || state.pendingDelete) return;

  const giftRef = doc(state.firestore, 'gifts', gift.id);
  const reservationRef = doc(state.firestore, 'reservations', gift.id);

  try {
    state.pendingDelete = true;
    elements.confirmDeleteButton.disabled = true;
    elements.cancelDeleteButton.disabled = true;
    elements.confirmDeleteButton.textContent = 'Удаляем…';
    clearDeleteError();

    await runTransaction(state.firestore, async (transaction) => {
      const reservationSnapshot = await transaction.get(reservationRef);
      const giftSnapshot = await transaction.get(giftRef);
      if (reservationSnapshot.exists()) {
        const error = new Error('Gift is reserved');
        error.code = 'gift-is-reserved';
        error.reservation = reservationSnapshot.data();
        throw error;
      }
      if (giftSnapshot.exists()) transaction.delete(giftRef);
    });

    elements.deleteDialog.close();
    state.deletingGift = null;
    showToast('Подарок удалён.');
  } catch (error) {
    if (error.code === 'gift-is-reserved') {
      state.reservations?.set(gift.id, error.reservation);
      renderGiftList();
      showDeleteError(`Удаление отменено: подарок закреплён за ${error.reservation.displayName || 'гостем'}.`);
    } else {
      showDeleteError(getFirestoreErrorMessage(error, 'Не удалось удалить подарок.'));
      console.error(error);
    }
  } finally {
    state.pendingDelete = false;
    elements.cancelDeleteButton.disabled = false;
    elements.confirmDeleteButton.textContent = 'Удалить';
    elements.confirmDeleteButton.disabled = Boolean(state.deletingGift && state.reservations?.has(state.deletingGift.id));
  }
}

function updateImagePreview() {
  const url = elements.giftImageUrl.value.trim();
  if (!isHttpUrl(url)) {
    hideImagePreview();
    return;
  }

  elements.giftImagePreview.src = url;
  elements.giftImagePreviewWrap.classList.remove('hidden');
}

function hideImagePreview() {
  elements.giftImagePreview.removeAttribute('src');
  elements.giftImagePreviewWrap.classList.add('hidden');
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatGiftCount(count) {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${count} подарков`;
  if (remainder10 === 1) return `${count} подарок`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${count} подарка`;
  return `${count} подарков`;
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
    return 'Неверный email или пароль.';
  }
  if (error.code === 'auth/too-many-requests') return 'Слишком много попыток. Попробуйте позже.';
  if (error.code === 'auth/network-request-failed') return 'Нет соединения с Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'В Firebase не включён вход Email/Password.';
  return 'Не удалось войти. Проверьте данные и попробуйте ещё раз.';
}

function getFirestoreErrorMessage(error, fallback) {
  if (error.code === 'permission-denied') {
    return 'Firebase отклонил операцию. Опубликуйте обновлённые firestore.rules.';
  }
  if (error.code === 'unavailable') return 'Firebase временно недоступен. Попробуйте ещё раз.';
  return fallback;
}

function showLoginError(message) {
  elements.loginStatus.textContent = message;
  elements.loginStatus.classList.remove('hidden');
}

function clearLoginError() {
  elements.loginStatus.textContent = '';
  elements.loginStatus.classList.add('hidden');
}

function showAdminStatus(message, type = 'info') {
  elements.adminStatus.textContent = message;
  elements.adminStatus.dataset.type = type;
  elements.adminStatus.classList.remove('hidden');
}

function hideAdminStatus() {
  elements.adminStatus.textContent = '';
  elements.adminStatus.classList.add('hidden');
}

function showGiftFormError(message) {
  elements.giftFormStatus.textContent = message;
  elements.giftFormStatus.classList.remove('hidden');
}

function clearGiftFormError() {
  elements.giftFormStatus.textContent = '';
  elements.giftFormStatus.classList.add('hidden');
}

function showDeleteError(message) {
  elements.deleteStatus.textContent = message;
  elements.deleteStatus.classList.remove('hidden');
}

function clearDeleteError() {
  elements.deleteStatus.textContent = '';
  elements.deleteStatus.classList.add('hidden');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => elements.toast.classList.add('hidden'), 3800);
}
