# Baby Gift Registry

Static GitHub Pages site where friends can choose one baby gift. The public gift catalog lives in `gifts.json`; shared reservations live in Firebase Firestore.

Guests log in with a phone number. The app stores only that phone number in `localStorage`; names and selected gifts are loaded from Firestore user documents.

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

- `users/{phone}` for phone-based profiles and the selected gift id
- `reservations/{giftId}` for the shared gift reservation state

If a guest changes their mind, the app deletes their reservation and clears `selectedGiftId` on their user document.

The Firebase browser config is public by design. The Firestore rules protect reservations from normal overwrite/delete actions.

## Deploy

Push the repository to GitHub, then enable GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Source: GitHub Actions.
4. Push to `main` or run the `Deploy static site to GitHub Pages` workflow manually.

After GitHub publishes the page, share the Pages URL with friends.
