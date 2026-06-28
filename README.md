# Baby Gift Registry

Static GitHub Pages site where friends can choose one baby gift. The public gift catalog lives in `gifts.json`; shared reservations live in Firebase Firestore.

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
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Firestore database.
3. Copy the web app config into `firebase-config.js`.
4. Publish the rules from `firestore.rules`.

The Firebase browser config is public by design. The Firestore rules protect reservations from normal overwrite/delete actions.

## Deploy

Push the repository to GitHub, then enable GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Source: Deploy from a branch.
4. Branch: `main`.
5. Folder: `/ (root)`.

After GitHub publishes the page, share the Pages URL with friends.
