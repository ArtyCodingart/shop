# Visual Redesign And Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the registry UI and fix loading, selection, and confirmation states.

**Architecture:** Keep the static no-build app. Add boot, selected gift, skeleton, and custom confirmation markup to `index.html`; update `app.js` state to track Firestore loading and confirmed selection; replace `styles.css` with the beige animated design.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Firebase Web SDK.

---

### Task 1: Red Tests

**Files:**
- Modify: `tests/validate-static-files.mjs`

- [ ] Require boot view, selected gift section, confirmation modal, Firestore loading state, and no `window.confirm`.
- [ ] Run `node tests/validate-static-files.mjs` and confirm failure before implementation.

### Task 2: App Markup And State

**Files:**
- Modify: `index.html`
- Modify: `app.js`

- [ ] Add `bootView`, `selectedGiftSection`, `confirmModal`, and skeleton-compatible containers.
- [ ] Render boot before profile decision to prevent login flash.
- [ ] Track `giftsLoaded`, `reservationsLoaded`, `reservationsFailed`, `pendingReservation`, and `confirmGift`.
- [ ] Render skeleton cards until Firestore returns the first reservation snapshot.
- [ ] Show the selected gift section only when local selection is confirmed by Firestore.
- [ ] Replace browser confirm with custom modal and commit to Firestore only after custom confirmation.

### Task 3: Beige Animated UI

**Files:**
- Modify: `styles.css`

- [ ] Replace the existing palette with warm beige/caramel/cocoa tones.
- [ ] Add CSS animations for boot, skeleton shimmer, card reveal, modal fade/scale, hover lift, and selected gift reveal.
- [ ] Preserve responsive mobile/tablet/desktop layouts.

### Task 4: Verification

**Files:**
- No source edits expected.

- [ ] Run `node tests/validate-static-files.mjs`.
- [ ] Run `node tests/validate-gifts.mjs`.
- [ ] Run `node tests/validate-pages-workflow.mjs`.
- [ ] Commit with `feat: redesign gift registry experience`.
