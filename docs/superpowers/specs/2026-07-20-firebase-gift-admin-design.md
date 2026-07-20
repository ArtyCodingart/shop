# Firebase Gift Admin Design

## Goal

Move the gift catalog from `gifts.json` to Firebase Firestore and add a protected administration page for creating, editing, and deleting gifts.

## Administration Route

The static administration page lives at `api/gifts/index.html`. It is available locally at `/api/gifts/`; on the current GitHub Pages project site it is available at `/shop/api/gifts/`.

The page starts with an email/password form backed by Firebase Authentication. Only the authenticated account whose email is `arty.codingart@gmail.com` may use the administration interface. The password is never stored in source files or Firestore.

## Data Model

Firestore collection `gifts` is the sole catalog source of truth. Each document uses the gift ID as its document ID and stores:

- `id`
- `title`
- `category`
- `price`
- `description`
- `details`
- `marketUrl`
- `imageUrl`
- `sortOrder`
- `createdAt`
- `updatedAt`

The document ID is immutable after creation so existing reservation references remain valid. New gifts receive the next available `sortOrder`.

## Initial Migration

After the administrator signs in, the page checks the `gifts` collection. If it is empty, it reads the existing `gifts.json` and imports every gift in its current order. The JSON file remains in the repository only as the initial migration source; the public catalog does not fall back to it after migration.

## Administration Interface

The authenticated view contains an `Добавить подарок` button above the complete ordered gift list. Every item provides `Изменить` and `Удалить` actions.

The create/edit form contains ID, title, category, price, description, details, marketplace URL, and image URL. Edit mode keeps ID read-only. Saving validates required text and HTTP(S) URLs before writing to Firestore.

Deletion opens a confirmation dialog. If `reservations/{giftId}` exists, deletion is blocked and the dialog identifies the guest from the reservation display name. Otherwise the gift document may be deleted.

## Public Catalog

The main registry subscribes to the Firestore `gifts` collection ordered by `sortOrder`. Gift loading and reservation loading remain separate states. Firestore updates appear without a page reload, and owned reservations continue to resolve gifts by document ID.

## Security Rules

Gift reads are public. Gift creates, updates, and deletes require Firebase Authentication with the exact administrator email. Delete rules also require that no matching reservation document exists. Existing user and reservation rules remain unchanged.

The client repeats the same checks for clear feedback, but Firestore rules are the authority.

## Error Handling

Authentication, import, load, save, and delete errors are shown inside the administration page. Failed writes keep the form open. An empty catalog is shown explicitly. Signing out returns to the login form.

## Scope

The implementation is local only: no commits and no new automated tests. Existing `gifts.json` remains as migration data, while Firestore becomes the runtime catalog source.
