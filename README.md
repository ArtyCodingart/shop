# Baby Gift Registry

Static GitHub Pages site where friends can choose multiple baby gifts. The public gift catalog lives in `gifts.json`; shared reservations live in Firebase Firestore.

Guests log in with a phone number. The app stores only that phone number in `localStorage`; names are loaded from Firestore user documents, while `reservations/{giftId}` is the source of truth for every selected gift. A guest can release one reservation without affecting their other gifts.

## Local Preview

Do not open `index.html` directly through `file://`. Browsers restrict local module/data loading, so use a local static server:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Edit Gifts

Update `gifts.json`. Each gift needs:

- `id`
- `title`
- `category`
- `price`
- `description`
- `details`
- `marketUrl`
- `imageUrl`

Validate after editing:

```bash
node --test tests/task3-behavior.test.cjs
node --test tests/registry-core.test.cjs
node tests/validate-gifts.mjs
node tests/validate-static-files.mjs
node tests/validate-pages-workflow.mjs
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Firestore database.
3. Copy the web app config into `firebase-config.js`.
4. Publish the rules from `firestore.rules`.

Firestore uses:

- `users/{phone}` for phone-based profiles; the legacy empty `selectedGiftId` remains only for deployed-rule compatibility
- `reservations/{giftId}` as the source of truth for shared gift reservation state

A phone may own any number of reservation documents. Cancelling a gift deletes only its reservation.

The Firebase browser config is public by design. The Firestore rules protect reservations from normal overwrite/delete actions.

## Deploy

Push the repository to GitHub, then enable GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Source: GitHub Actions.
4. Push to `main` or run the `Deploy static site to GitHub Pages` workflow manually.

After GitHub publishes the page, share the Pages URL with friends.
