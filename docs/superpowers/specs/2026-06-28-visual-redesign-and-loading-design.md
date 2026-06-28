# Visual Redesign And Loading Design

## Goal

Redesign the gift registry into a warm beige, animated experience and fix state transitions around login, Firestore loading, gift selection, and confirmation.

## Behavior

The app starts on a dedicated boot screen. Login and catalog views stay hidden until local profile state is restored and the first render decision is known, preventing a flash of the login form for returning users.

After login, the catalog does not expose active gift actions until gift data and the first Firestore reservation snapshot are known. During that period the page shows skeleton cards with a soft shimmer. If Firebase cannot load, reservation actions remain disabled and a banner explains the issue.

When a user has a confirmed gift reservation, the catalog adds a top section focused on that gift. It shows the selected product image, title, price, details, and marketplace link. The full list remains below, and the selected gift still appears in the grid with the “Ваш подарок” state.

Gift selection uses a custom confirmation dialog instead of `window.confirm`. The dialog shows the selected gift and offers explicit confirm/cancel actions. Confirming writes to Firestore, shows a pending state, and only updates local selection after Firestore succeeds.

## Visual Direction

The redesign uses beige and warm neutral tones: ivory, sand, oat, honey, caramel, and cocoa text. The interface should feel gentle and premium rather than childish.

Animations are CSS-only and purposeful:

- boot screen fade-in and soft floating decorative shapes
- skeleton shimmer while Firestore loads
- catalog and selected gift reveal animations
- gift card hover lift
- modal fade and scale
- confirmation dialog transition

Motion must not block use and should stay readable on mobile.

## Verification

Validation should confirm:

- boot view exists and login/catalog are initially hidden
- custom confirmation modal exists
- selected gift section exists
- app has Firestore loading state
- `window.confirm` is no longer used
- existing gift and static validations still pass
