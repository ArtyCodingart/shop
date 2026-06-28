# Gift Registry Site Design

## Goal

Build a small public GitHub Pages site where friends can choose one baby gift to bring for an upcoming birth. The site should feel warm, polished, and easy to use on mobile and desktop.

## Hosting And Storage

The site will be static and hosted with GitHub Pages from this repository. GitHub Pages will serve:

- `index.html`
- `styles.css`
- `app.js`
- `gifts.json`

The initial catalog will use external image URLs in `gifts.json` so the first version works without an asset pipeline. Later, those URLs can be replaced with local image paths in the repository.

Gift reservations will be stored in Firebase Firestore on the free Spark plan. GitHub Pages cannot safely write back to a shared JSON file from a visitor browser, so Firestore is the shared backend for “who selected what”.

## Data Model

`gifts.json` is the editable public catalog. It contains the gifts the site renders:

- `id`
- `title`
- `category`
- `price`
- `description`
- `details`
- `marketUrl`
- `imageUrl`

Firestore stores reservations in a `reservations` collection. Each document id matches the gift id:

- `giftId`
- `firstName`
- `lastName`
- `displayName`
- `createdAt`

Using the gift id as the reservation document id lets the app create a reservation only when that gift has not already been reserved.

## User Flow

The first screen shows a login form with first name and last name. After submit, the app stores this profile in `localStorage` and shows the main gift catalog.

The main screen shows all gifts as cards. Available gifts are active. Reserved gifts are disabled, visually gray, and show a label like “Уже дарит Имя Фамилия”.

When a user opens an available gift, a modal shows:

- large product image
- title, price, category, and detailed description
- link to the marketplace
- large primary button: “Я хочу подарить этот подарок”

After pressing the primary button, the app asks for confirmation. If the user confirms, the app writes the reservation to Firestore. If the write succeeds, the user’s chosen gift is stored locally and the catalog updates. If another visitor reserved the same gift first, the app shows that the gift is already taken and refreshes reservation state.

Each visitor can choose only one gift from the UI. If they have already chosen a gift, other available gift buttons are disabled with a short message explaining that one gift is already selected.

## Firebase Configuration

The public Firebase browser config will live in `app.js` or a small `firebase-config.js` file. Firebase web config values are not secrets, but the Firestore rules must limit writes.

Recommended Firestore rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /reservations/{giftId} {
      allow read: if true;
      allow create: if
        !exists(/databases/$(database)/documents/reservations/$(giftId)) &&
        request.resource.data.giftId == giftId &&
        request.resource.data.firstName is string &&
        request.resource.data.lastName is string &&
        request.resource.data.displayName is string &&
        request.resource.data.createdAt is timestamp;
      allow update, delete: if false;
    }
  }
}
```

Because this design uses name-only login without real authentication, it is suitable for a trusted friend group but not for sensitive or adversarial use.

## Interface Direction

The design should be soft and celebratory without becoming childish. The first screen should feel like a small invitation. The catalog should prioritize clear scanning: gift image, title, price, short description, availability, and one obvious action.

The page should be responsive:

- mobile: single-column catalog and full-width modal actions
- tablet: two-column catalog
- desktop: three-column catalog with comfortable spacing

The UI should avoid decorative clutter. Cards, buttons, and modal states should be polished, accessible, and readable.

## Error Handling

If `gifts.json` fails to load, the app shows a friendly error and a retry action.

If Firebase is not configured yet, the app still renders the catalog and shows a setup message for reservation actions.

If Firestore read fails, the app shows gifts without reservation state and explains that live availability is temporarily unavailable.

If reservation write fails, the app shows a clear message and does not mark the gift as selected locally unless Firestore confirms the reservation.

## Testing And Verification

Manual verification should cover:

- first-name and last-name login stored in `localStorage`
- catalog loads from `gifts.json`
- modal opens and closes correctly
- unavailable gifts render gray with reserver name
- one-user-one-gift UI restriction
- Firebase not-configured state is understandable
- responsive layout at mobile and desktop widths
- GitHub Pages-compatible static file paths

If practical, simple automated checks can validate that `gifts.json` is valid JSON and every gift has required fields.
