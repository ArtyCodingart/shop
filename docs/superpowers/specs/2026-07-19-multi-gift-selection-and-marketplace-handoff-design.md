# Multi-Gift Selection And Marketplace Handoff Design

## Goal

Allow one guest to choose any number of currently available gifts, cancel those choices one at a time, and reliably register a new choice before sending the guest to the marketplace.

The design also replaces the large single-selection panel with a compact grid that reuses the catalog card presentation. It does not attempt to verify that a marketplace purchase was completed. The registry records the guest's stated intention at the final handoff step.

## Agreed User Experience

### Selected Gifts Section

When the signed-in guest owns at least one reservation, the catalog shows a section titled `Ваши подарки` above the full catalog. Its supporting text explains that the guest plans to buy these gifts and can click a card to return to the marketplace.

The section renders one compact card per owned reservation. These cards reuse the same gift-card component and visual structure as the main catalog cards instead of introducing a second large presentation. Each selected card:

- shows the gift image, category, title, description, and the status `Вы покупаете этот подарок`;
- opens the gift marketplace URL in the current browser tab when the card body is activated;
- has an individual `Отказаться` button;
- keeps the `Отказаться` button aligned to the bottom edge, regardless of title or description length.

The section is hidden when the guest has no reservations.

### Full Catalog

The full catalog continues to show every gift, including gifts selected by the current guest.

Each catalog card has one of three states:

1. A free gift opens the first confirmation dialog when either the card or `Я хочу купить` is activated.
2. A gift owned by the current guest displays `Этот подарок покупаете вы` and the action `Перейти в магазин`. Activating either the card or that action opens the marketplace directly in the current tab.
3. A gift reserved by another guest displays the existing `Уже покупает {displayName}` status and a disabled `Уже купят` action. It does not open the purchase flow.

There is no maximum number of gifts that one guest may select.

### Two-Step Marketplace Handoff

Activating a free gift starts the same flow from both the card body and its action button.

The first dialog is intentionally short:

- title: `Хотите купить этот подарок?`;
- the selected gift name is visible;
- actions: `Нет` and `Да`.

`Нет`, the backdrop, or `Escape` closes the dialog. `Да` closes the first dialog and opens the explanatory dialog without reserving the gift.

The second dialog is titled `Как это работает`. It explains that:

- the registry will first reserve the gift for the guest;
- the marketplace will then open automatically;
- the guest must independently finish and pay for the order in the marketplace;
- no marketplace transition occurs if the gift can no longer be reserved.

The second dialog has `Назад` and `Понятно, перейти` actions. `Назад` returns to the first confirmation step without changing data.

When the guest activates `Понятно, перейти`:

1. The final action becomes disabled and displays `Закрепляем…`.
2. The app attempts to create the reservation transactionally.
3. On success, the dialog displays `Подарок закреплён. Открываем магазин…`.
4. After 700 milliseconds, the app navigates the current tab to the gift marketplace URL.

The reservation is therefore created only from the final explanatory dialog, after the guest has acknowledged how the handoff works.

### Individual Cancellation

Activating `Отказаться` on a selected-gift card does not trigger the card's marketplace navigation. It opens a cancellation dialog whose copy names the specific gift.

The cancellation dialog actions remain `Оставить подарок` and `Да, отказаться`.

Confirming cancellation transactionally verifies ownership and deletes only that reservation. Other reservations belonging to the same guest remain unchanged. The selected section and the full catalog then re-render, and the released gift becomes available to everyone.

## Data Model And Compatibility

Firestore `reservations/{giftId}` documents become the only source of truth for gift ownership. A reservation belongs to the current guest when its `phone` equals the normalized phone on the loaded profile.

The app derives the guest's selected gifts by filtering the already subscribed reservation map and resolving the matching gift records from `gifts.json`. It does not maintain a second array of gift IDs in the user document.

Existing `users/{phone}.selectedGiftId` fields are treated as legacy data:

- the app no longer reads the field to determine ownership;
- choosing, switching, or cancelling a gift no longer updates the field;
- an existing reservation remains visible because its reservation document already contains the guest's phone;
- a legacy `selectedGiftId` with no matching reservation has no effect;
- new profile creation continues writing an empty `selectedGiftId` solely for compatibility with currently deployed Firestore rules, but the field has no selection semantics.

This strategy requires no data migration and avoids synchronization failures between a user document and multiple reservation documents.

## State And Components

The single-selection and switch-specific state is removed. In particular, the UI no longer needs `switchGift`, `pendingSwitch`, `openSwitchChoiceModal`, or `switchConfirmedGift`.

The app instead keeps explicit state for:

- the gift being considered in the two-step purchase flow;
- the gift being considered for cancellation;
- a pending reservation transaction;
- a pending cancellation transaction.

A shared gift-card renderer accepts a context describing whether the card is in the selected section or the full catalog. This keeps image, metadata, sizing, and bottom-aligned action layout consistent while allowing context-specific actions.

Both pointer and keyboard activation follow the same state rules. Nested action buttons stop propagation so cancellation cannot navigate to the marketplace and catalog actions cannot fire twice.

## Transaction Flow

### Reserve A Gift

The final handoff action runs a Firestore transaction against `reservations/{giftId}`:

1. Read the reservation document.
2. If it exists, abort with a conflict result.
3. If it does not exist, create it with the current profile's phone, first name, last name, display name, gift ID, and server timestamp.

No user document update is part of this transaction. The local reservation map is updated immediately after success for consistent UI state while the live Firestore subscription remains authoritative.

### Cancel One Gift

The cancellation action runs a Firestore transaction against the targeted `reservations/{giftId}`:

1. Read the reservation document.
2. If it does not exist or its phone differs from the current profile phone, abort without deleting anything.
3. Otherwise delete that reservation document.

No other reservation is read, replaced, or deleted.

The application remains a trusted-friends, phone-only registry rather than an authenticated commerce system. Client-side ownership checks prevent accidental cancellation in the normal UI but do not provide strong identity security without Firebase Authentication.

## Loading And Error Handling

The existing catalog and reservation skeleton behavior remains unchanged.

During a pending reserve or cancel transaction, the active dialog cannot be dismissed through its buttons, backdrop, or `Escape`, and repeated submissions are disabled.

Reservation failures are handled as follows:

- If another guest reserved the gift first, close the purchase dialogs, refresh the visible reservation state, show that the gift was already selected, and do not navigate.
- If a network or temporary Firebase error occurs, keep the explanatory dialog open, restore its final action, show a retryable error, and do not navigate.

Cancellation failures are handled as follows:

- If the reservation is already missing or no longer belongs to the current phone, close the cancellation dialog, refresh the UI, and report that the gift could not be released from this profile.
- If a temporary Firebase error occurs, keep the cancellation dialog open, restore the confirmation action, and allow retry.

The marketplace URL is opened only after a successful reservation transaction. Navigation uses the current tab so browsers cannot block it as a delayed popup after the asynchronous Firestore operation.

## Accessibility

Cards expose an accessible action description that matches their current behavior: starting the selection flow, opening the marketplace, or being unavailable. Keyboard activation mirrors pointer activation.

Dialogs retain their accessible titles, dialog semantics, backdrop behavior, and `Escape` support. When a dialog closes without marketplace navigation, focus returns to its originating card if that card is still present in the document. Pending operations keep the dialog visible and communicate progress through the disabled action text and existing status feedback.

## Documentation Changes

`README.md` will describe reservations, rather than `selectedGiftId`, as the source of truth for all selections. It will also explain that one guest can reserve multiple gifts and cancel each reservation independently.

The legacy user field remains documented only as a compatibility detail if it remains in profile creation.

## Verification

Implementation begins with failing validation for the new behavior. Automated checks will cover:

- deriving multiple owned gifts from reservations with the current profile phone;
- allowing a second free gift after the guest already owns one;
- removing one owned gift without affecting other owned gifts;
- retaining owned gifts in the full catalog with current-user status;
- removing the switch-selection flow and all writes that assign a selected gift to the user document;
- the required first and explanatory dialog elements and actions;
- preventing marketplace navigation before the reservation transaction succeeds;
- suppressing navigation after a conflict or network failure;
- direct marketplace navigation for already-owned gifts;
- propagation guards on nested card actions;
- bottom alignment of the selected-card cancellation action;
- all existing gift, static-file, and GitHub Pages validators.

Manual browser verification will exercise the full two-dialog flow, the 700 millisecond success handoff, multiple selected cards on desktop and mobile widths, keyboard activation, and cancellation of one gift from a set of at least two.
