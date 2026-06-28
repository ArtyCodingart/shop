# Phone Login And Gift Cancel Design

## Goal

Replace name-based local login with phone-only login backed by Firestore user documents, and allow a guest to cancel their selected gift so they can choose another one.

## Data Model

`localStorage` stores only the normalized phone number under `babyGiftRegistry.phone`.

Firestore stores users in `users/{phone}`:

- `phone`
- `firstName`
- `lastName`
- `displayName`
- `selectedGiftId`
- `createdAt`
- `updatedAt`

Firestore reservations remain in `reservations/{giftId}`, but each reservation also stores:

- `phone`
- `giftId`
- `firstName`
- `lastName`
- `displayName`
- `createdAt`

The app treats the user document as the source of truth for the current visitor profile and selected gift.

## User Flow

The first login form asks only for phone number. After submit, the app normalizes the phone and reads `users/{phone}`.

If the user exists, their name and selected gift are loaded from Firestore. If the user does not exist, the app shows a one-time registration form for first name and last name while keeping the entered phone. Creating the profile saves `users/{phone}` and then opens the catalog.

When a gift is selected, the app creates `reservations/{giftId}` and updates `users/{phone}.selectedGiftId`. Local storage remains phone-only.

When a gift is already selected, the selected gift section includes a visible button: “Передумал`а дарить подарок”. Below it, gray helper text explains that choosing another gift requires cancelling the current one first.

Clicking the cancel button opens a custom confirmation dialog. Confirming deletes `reservations/{selectedGiftId}` and clears `users/{phone}.selectedGiftId`. The catalog then lets the user choose another gift.

## Security Notes

This remains a trusted-friends app without password or SMS authentication. Firestore rules should prevent accidental overwrite as much as possible, but phone-only identity is not strong authentication.

The rules allow public reads, user profile creation/update by document phone shape, reservation creation if the gift is free, and reservation delete for trusted cancellation.

## Verification

Validation should confirm:

- phone input exists and first/last name are not used for login
- registration form exists for new phone users
- app stores `babyGiftRegistry.phone`
- app does not use `babyGiftRegistry.profile` or `babyGiftRegistry.selection`
- app reads and writes `users/{phone}`
- app can delete a reservation
- cancel confirmation modal exists
