# Baby Gift Registry

Static GitHub Pages site where friends can choose multiple baby gifts. The public gift catalog and shared reservations live in Firebase Firestore.

Guests log in with a phone number. The app stores only that phone number in `localStorage`; names are loaded from Firestore user documents, while `reservations/{giftId}` is the source of truth for every selected gift. A guest can release one reservation without affecting their other gifts.

## Local Preview

Do not open `index.html` directly through `file://`. Browsers restrict local module/data loading, so use a local static server:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Manage Gifts

Firestore collection `gifts` is the source of truth for the public catalog. Open the administration page:

- locally: `http://localhost:4173/api/gifts/`
- on GitHub Pages: `/shop/api/gifts/`

Sign in with the Firebase Authentication administrator account `arty.codingart@gmail.com`. The page supports adding, editing, and deleting gifts. A reserved gift cannot be deleted until its reservation is released.

An empty Firestore collection stays empty until the administrator adds the first gift. Each Firestore gift contains:

- `id`
- `title`
- `category`
- `price`
- `description`
- `details`
- `marketUrl`
- `imageUrl`

Repository validation commands:

```bash
node --test tests/task3-behavior.test.cjs
node --test tests/registry-core.test.cjs
node tests/validate-static-files.mjs
node tests/validate-pages-workflow.mjs
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Firestore database.
3. Copy the web app config into `firebase-config.js`.
4. In Authentication, enable Email/Password and create the administrator account.
5. Add `localhost` and the GitHub Pages domain to Authentication authorized domains.
6. Publish the rules from `firestore.rules` in Firestore Database → Rules.

Firestore uses:

- `users/{phone}` for phone-based profiles; the legacy empty `selectedGiftId` remains only for deployed-rule compatibility
- `reservations/{giftId}` as the source of truth for shared gift reservation state
- `gifts/{giftId}` as the source of truth for the public gift catalog

A phone may own any number of reservation documents. Cancelling a gift deletes only its reservation.

Gift reads are public. Gift writes require the authenticated administrator email, and Firestore rules block deletion when a matching reservation exists. The administrator password is stored only by Firebase Authentication and never in this repository.

The Firebase browser config is public by design. The Firestore rules protect reservations from normal overwrite/delete actions.

## Deploy

Push the repository to GitHub, then enable GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Source: GitHub Actions.
4. Push to `main` or run the `Deploy static site to GitHub Pages` workflow manually.

After GitHub publishes the page, share the Pages URL with friends.
