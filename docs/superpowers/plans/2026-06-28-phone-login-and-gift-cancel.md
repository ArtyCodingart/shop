# Phone Login And Gift Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make phone number the only local login identifier and let users cancel their selected gift.

**Architecture:** Keep the static app and Firebase client. Add a Firestore `users/{phone}` profile flow, move selected gift state into that user document, include phone in reservations, and support trusted cancellation by deleting the reservation and clearing the user document.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Firebase Web SDK, Firestore rules.

---

### Task 1: Tests

**Files:**
- Modify: `tests/validate-static-files.mjs`

- [ ] Require phone login, registration form, cancel confirmation modal, user document code, `deleteDoc`, and phone-only localStorage.
- [ ] Run the validator and confirm it fails before implementation.

### Task 2: Markup And Styles

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Replace login first/last inputs with phone input.
- [ ] Add one-time registration view for first name and last name.
- [ ] Add cancel confirmation modal.
- [ ] Add selected gift cancel button and helper text styles.

### Task 3: App Logic

**Files:**
- Modify: `app.js`

- [ ] Replace profile/selection localStorage with `babyGiftRegistry.phone`.
- [ ] Load `users/{phone}` after Firebase is ready.
- [ ] Create a user profile when phone is new.
- [ ] Write reservation and update user `selectedGiftId` when selecting.
- [ ] Delete reservation and clear user `selectedGiftId` when cancelling.

### Task 4: Rules And Verification

**Files:**
- Modify: `firestore.rules`
- Modify: `README.md`

- [ ] Add users rules and update reservation rules for `phone`.
- [ ] Document the phone login and cancellation model.
- [ ] Run all validators and commit.
