# Firebase Gift Admin Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. The user explicitly requested no new tests and no commits, so test-writing and commit steps are intentionally omitted.

**Goal:** Store gifts only in Firestore and provide an authenticated `/api/gifts/` administration page for creating, updating, and safely deleting gifts.

**Architecture:** The public catalog and admin page share the existing Firebase project. `gifts/{giftId}` is the only catalog source; public clients may read it, while Firestore rules allow writes only to the configured Firebase Authentication email. An empty collection stays empty until the administrator creates a gift, and deletion is prevented whenever `reservations/{giftId}` exists.

**Tech Stack:** Static HTML/CSS/JavaScript, Firebase JavaScript SDK 10.12.4, Firebase Authentication, Cloud Firestore, GitHub Pages.

---

### Task 1: Protect The Firestore Gift Collection

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add an administrator predicate**

Add a database-scoped helper so authenticated Firebase tokens, rather than client UI state, determine write access:

```rules
function isGiftAdmin() {
  return request.auth != null &&
    request.auth.token.email == 'arty.codingart@gmail.com';
}
```

- [ ] **Step 2: Add gift validation and access rules**

Add `match /gifts/{giftId}` with public reads, admin-only writes, stable IDs, typed fields, HTTP(S) URLs, immutable `createdAt`, and reservation-aware deletion:

```rules
match /gifts/{giftId} {
  allow read: if true;
  allow create: if isGiftAdmin() &&
    request.resource.data.id == giftId &&
    request.resource.data.title is string &&
    request.resource.data.category is string &&
    request.resource.data.price is string &&
    request.resource.data.description is string &&
    request.resource.data.details is string &&
    request.resource.data.marketUrl.matches('^https?://.+') &&
    request.resource.data.imageUrl.matches('^https?://.+') &&
    request.resource.data.sortOrder is int &&
    request.resource.data.createdAt is timestamp &&
    request.resource.data.updatedAt is timestamp;
  allow update: if isGiftAdmin() &&
    request.resource.data.id == giftId &&
    request.resource.data.createdAt == resource.data.createdAt &&
    request.resource.data.title is string &&
    request.resource.data.category is string &&
    request.resource.data.price is string &&
    request.resource.data.description is string &&
    request.resource.data.details is string &&
    request.resource.data.marketUrl.matches('^https?://.+') &&
    request.resource.data.imageUrl.matches('^https?://.+') &&
    request.resource.data.sortOrder is int &&
    request.resource.data.updatedAt is timestamp;
  allow delete: if isGiftAdmin() &&
    !exists(/databases/$(database)/documents/reservations/$(giftId));
}
```

Keep the existing `users` and `reservations` matches unchanged.

### Task 2: Make Firestore The Public Catalog Source

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Remove the JSON runtime loader**

Delete `loadGifts()` and remove `await loadGifts()` from `init()`. Gift loading must start only after Firebase initialization.

- [ ] **Step 2: Subscribe to ordered gifts**

Add a subscription next to `subscribeToReservations()`:

```js
function subscribeToGifts() {
  const { collection, onSnapshot, orderBy, query } = state.firebaseApi;
  const giftsQuery = query(collection(state.firestore, 'gifts'), orderBy('sortOrder'));

  onSnapshot(
    giftsQuery,
    (snapshot) => {
      state.gifts = snapshot.docs.map((giftDoc) => ({ id: giftDoc.id, ...giftDoc.data() }));
      state.giftsLoaded = true;
      renderGifts();
      renderSelectedGifts();
    },
    (error) => {
      state.giftsLoaded = true;
      showBanner('Не удалось загрузить список подарков. Обновите страницу чуть позже.');
      renderGifts();
      renderSelectedGifts();
      console.error(error);
    }
  );
}
```

Call `subscribeToGifts()` after `state.firestore`, `state.firebaseApi`, and `state.firebaseReady` are assigned. Keep the reservation subscription alongside it.

- [ ] **Step 3: Handle unavailable Firebase consistently**

When Firebase is not configured or initialization fails, set `state.giftsLoaded = true` as well as the existing reservation failure flags so the UI does not remain in a skeleton state forever.

### Task 3: Build The Administration Page Shell

**Files:**
- Create: `api/gifts/index.html`
- Create: `api/gifts/admin.css`

- [ ] **Step 1: Create the route document**

Create a Russian-language page that loads `../../firebase-config.js`, `./admin.css`, and `./admin.js`. Include:

- login form with `adminEmail`, `adminPassword`, and `adminLoginButton`;
- authenticated toolbar with `addGiftButton`, `adminIdentity`, and `logoutAdminButton`;
- status area `adminStatus`;
- gift list `adminGiftList`;
- native `<dialog id="giftDialog">` containing `giftForm`;
- inputs for `giftId`, `giftTitle`, `giftCategory`, `giftPrice`, `giftDescription`, `giftDetails`, `giftMarketUrl`, and `giftImageUrl`;
- submit and cancel actions;
- native `<dialog id="deleteDialog">` with confirmation copy and actions.

All scripts stay at the end of `<body>` or use `defer`, and all form controls have visible labels.

- [ ] **Step 2: Style the admin states**

Create a responsive layout matching the registry palette. The desktop gift list uses a compact table/card hybrid; mobile stacks image, content, and actions. Provide distinct styles for loading, errors, destructive actions, disabled deletion, dialogs, form validation, and empty state.

### Task 4: Implement Firebase Authentication And Realtime Data

**Files:**
- Create: `api/gifts/admin.js`

- [ ] **Step 1: Initialize Firebase modules**

Import Firebase app, auth, and Firestore modules from version `10.12.4`. Initialize with `window.giftRegistryFirebase.config`, then create `auth` and `firestore` instances. Keep the allowed address in one constant:

```js
const ADMIN_EMAIL = 'arty.codingart@gmail.com';
```

- [ ] **Step 2: Bind email/password authentication**

Use `signInWithEmailAndPassword()` for the login form, `signOut()` for logout, and `onAuthStateChanged()` to switch views. If an authenticated user has another email, immediately sign out and show `У этого аккаунта нет доступа.` Never store or prefill the password.

- [ ] **Step 3: Subscribe to gifts and reservations**

Subscribe to ordered gifts and the reservation collection. Store both in local state, then render every gift with its preview, fields, edit action, and deletion state. A matching reservation disables deletion and displays `Закреплён за: {displayName}`.

### Task 5: Implement Create, Update, And Safe Delete

**Files:**
- Modify: `api/gifts/admin.js`

- [ ] **Step 1: Open create and edit forms**

`Добавить подарок` opens an empty form with editable ID. `Изменить` fills the form and makes ID read-only. Validate the ID against `^[a-z0-9]+(?:-[a-z0-9]+)*$`, require trimmed text fields, and accept only `http:` or `https:` URLs.

- [ ] **Step 2: Create gifts transactionally**

For create mode, use `runTransaction()` to verify that `gifts/{giftId}` does not exist before setting it. Store the next `sortOrder`, both timestamps, and every catalog field. On an existing ID, keep the dialog open and show `Подарок с таким ID уже существует.`

- [ ] **Step 3: Update without changing identity**

For edit mode, update only mutable catalog fields plus `updatedAt`. Preserve `id`, `sortOrder`, and `createdAt`.

- [ ] **Step 4: Delete only unreserved gifts**

Disable the delete action when the live reservation map contains the gift ID. On confirmation, run a Firestore transaction that reads `reservations/{giftId}` again and aborts if it exists; otherwise delete `gifts/{giftId}`. This closes the race between opening the dialog and confirming deletion.

- [ ] **Step 5: Preserve usable pending and error states**

Disable repeated submissions while a login, save, or delete operation is pending. Restore buttons after failures, keep forms open for correction, focus the first invalid field, and close dialogs only after successful writes.

### Task 6: Document Setup And Perform Manual Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new catalog source and route**

Replace the JSON editing instructions with Firestore/admin instructions. Document local `/api/gifts/`, deployed `/shop/api/gifts/`, Firebase Authentication Email/Password, the allowed administrator account, empty-catalog behavior, and the required Firestore rules deployment. Do not document the password.

- [ ] **Step 2: Remove the legacy JSON catalog**

Delete `gifts.json`, remove `node tests/validate-gifts.mjs` from `.github/workflows/pages.yml` and README validation commands, and leave `tests/validate-gifts.mjs` unused for historical reference. Do not add or run tests.

- [ ] **Step 3: Perform syntax and HTTP checks without adding tests**

Run only non-test diagnostics:

```bash
node --check app.js
node --check api/gifts/admin.js
curl -I http://127.0.0.1:4173/api/gifts/
```

Expected: JavaScript syntax checks exit `0`; the admin route responds `200`.

- [ ] **Step 4: Verify the authenticated workflow manually**

Open `/api/gifts/`, sign in, confirm an empty collection remains empty, then add a gift, edit it, and delete it. Reserve another gift through the public catalog and confirm its admin delete button is disabled with the guest name. Confirm public catalog changes appear without reload and that logout returns to the login form.

- [ ] **Step 5: Leave work uncommitted**

Inspect `git status --short` and report all modified/created files. Do not stage or commit anything.
