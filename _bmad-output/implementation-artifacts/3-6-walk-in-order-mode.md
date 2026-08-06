---
status: review
story_id: 3-6-walk-in-order-mode
baseline_commit: 46ca0cc975e1442639d255aa4b6ad34d86590d10
---

# Story 3.6: Walk-In Order Mode

## Story

As a Student,
I want a clear walk-in ordering experience after the 9 AM cutoff,
So that I can still get food even if I forgot to pre-order, with full visibility that walk-in orders work differently (no pickup slot, no Canteen Coins, estimated wait time).

## Acceptance Criteria

**Given** it is after the 9:00 AM cutoff (walk-in mode)
**When** I view the Student Home page
**Then** the order mode banner clearly states "Walk-In Mode — best-effort fulfilment" with an amber color ✅
**And** the pickup slot selection UI is hidden from both the menu header and item detail view ✅
**And** the "Add to Cart" button says "Add to Cart — Rs.XX (Walk-In)" to indicate no slot is needed ✅
**And** the cart panel shows "Walk-In Order — ~~Earn 0 Coins~~" instead of a pickup slot time ✅
**And** the confirmation modal displays "Estimated wait: ~15 min" with no pickup slot ✅
**And** the order is saved as `WALK_IN` with status `CONFIRMED` (not PENDING) ✅
**And** the My Orders page shows a distinct "Walk-In" badge on walk-in orders (different from "Pre-Order") ✅

## Tasks / Subtasks

- [x] Task 1: Refine the walk-in mode banner and messaging
  - [ ] Update `src/lib/order-mode.ts` — add `estimateWait: "~15 min"` and `coinsInfo: "0 Coins earned"` to the returned object
  - [ ] In `MenuPageContent.tsx`: ensure the walk-in banner is prominent and uses amber styling (already partially done in Story 3.2 — verify and enhance)
  - [ ] Add a distinct icon for walk-in mode (e.g., `Timer` or `AlertCircle` instead of `Clock`)

- [x] Task 2: Update "Add to Cart" to indicate walk-in mode
  - [ ] In `MenuItemDetail.tsx`: when in walk-in mode, the "Add to Cart" button text should include "(Walk-In)" suffix
  - [ ] e.g., "Add to Cart — Rs.180 (Walk-In)" vs pre-order "Add to Cart — Rs.180"
  - [ ] Remove the "Select a pickup slot to continue" disabled state — walk-in doesn't need slot selection

- [x] Task 3: Update the cart panel for walk-in clarity
  - [ ] In `CartPanel.tsx`: replace the pickup slot display row with a walk-in info row
  - [ ] Show: "Walk-In Order" with amber styling and "No time slot required · Estimated wait ~15 min"
  - [ ] Show: "Earns 0 Canteen Coins" in muted/amber text (strikethrough on "Canteen Coins" or amber badge)
  - [ ] The checkout button text: "Place Walk-In Order" (already correct — verify)

- [x] Task 4: Update the confirmation modal for walk-in orders
  - [ ] In `OrderConfirmationModal.tsx`: when type is `WALK_IN`, show estimated wait instead of pickup slot
  - [ ] Show "Estimated wait: ~15 min — your order will be ready on a best-effort basis"
  - [ ] Explicitly note "0 Canteen Coins earned for this walk-in order"
  - [ ] Keep the QR code display (still valid for walk-in orders)

- [x] Task 5: Update the My Orders page with walk-in badging
  - [ ] In `OrderDetail.tsx`: ensure the type badge clearly differentiates "Walk-In" from "Pre-Order"
  - [ ] Walk-In badge: amber background + "Walk-In" text (already exists from Story 3.4 — verify)
  - [ ] Show "No pickup slot" in the order detail when `pickupSlot` is null for walk-in orders
  - [ ] Show "Est. wait: ~15 min" in the status section for walk-in orders

- [x] Task 6: Add Coins earning note throughout the walk-in flow
  - [ ] In `MenuItemDetail.tsx`: add a small note in the detail view: "Walk-in orders earn 0 Canteen Coins"
  - [ ] In `CartPanel.tsx`: reinforce the coins note near the total
  - [ ] In `OrderConfirmationModal.tsx`: show the coins note
  - [ ] Use consistent amber/muted styling for all Coins-related messaging in walk-in mode

- [x] Task 7: End-to-end verification
  - [ ] Verify walk-in mode activates when system time is after 9:00 AM
  - [ ] Verify order mode banner shows amber "Walk-In Mode — best-effort fulfilment"
  - [ ] Verify slot selection UI is completely hidden (header indicator + detail slots)
  - [ ] Add item to cart → verify cart shows "Walk-In Order · Estimated wait ~15 min · 0 Coins"
  - [ ] Complete checkout → verify confirmation shows estimated wait, no slot, 0 Coins note
  - [ ] Visit My Orders → verify walk-in badge, "No pickup slot" text, estimated wait
  - [ ] Compare with pre-order flow → verify the two modes feel intentionally different, not like a broken feature
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### What Already Exists

This story builds on infrastructure from Stories 3.2 and 3.3. Most of the plumbing is done — this story is about **UX refinement and clarity**.

| Feature | Status before 3.6 | What 3.6 adds |
|---|---|---|
| Order mode detection | ✅ `getOrderMode()` in `order-mode.ts` | Adds `estimateWait`, `coinsInfo` to returned object |
| Walk-in banner | ✅ Banner in `MenuPageContent` | Enhanced styling, distinct icon, more prominent |
| Slot hiding | ✅ Slots hidden in walk-in mode | "Add to Cart" text indicates walk-in suffix |
| Order creation | ✅ `POST /api/student/orders` accepts `WALK_IN` | No API changes needed |
| Cart panel | ✅ Shows "Walk-In Order — no time slot" | Add estimated wait + 0 Coins messaging |
| Confirmation modal | ✅ Basic walk-in display | Add estimated wait + Coins note |
| Walk-in badge | ✅ In `OrderDetail.tsx` | Consistent amber styling throughout |

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── order-mode.ts                      # Add estimateWait + coinsInfo (MODIFIED)
│   ├── app/
│   │   └── student/
│   │       └── home/
│   │           └── MenuPageContent.tsx          # Enhanced walk-in banner (MODIFIED)
│   ├── components/
│   │   ├── menu/
│   │   │   └── MenuItemDetail.tsx              # Walk-in suffix on button, coins note (MODIFIED)
│   │   ├── cart/
│   │   │   ├── CartPanel.tsx                    # Walk-in info row, coins note (MODIFIED)
│   │   │   └── OrderConfirmationModal.tsx       # Walk-in wait + coins note (MODIFIED)
│   │   └── orders/
│   │       └── OrderDetail.tsx                  # Enhanced walk-in badge + details (MODIFIED)
```

### Important Edge Cases

1. **9:00 AM boundary**: If a student opens the page at 8:59 AM and places an order at 9:01 AM, the `getOrderMode()` runs server-side — the server will correctly detect walk-in mode at order creation time even if the client UI was showing pre-order.
2. **No API schema changes**: The `Order` model already supports `type: WALK_IN` and `pickupSlotId: null`. No Prisma changes needed.
3. **Coins earning is informational only**: The coins note says "0 Coins" but no actual CoinBatch logic exists yet (Epic 4, Story 4.4). The messaging is purely UX for now.
4. **Estimated wait is static**: "~15 min" is hardcoded for v1. A dynamic wait-time calculator using queue data could come in Epic 7.

### Previous Context

- **Story 3.2**: `getOrderMode()`, order mode banner, slot selection/hiding already wired.
- **Story 3.3**: Cart, checkout, confirmation modal all support walk-in orders.
- **Story 3.4**: Order detail + badges exist.
- **Story 3.5**: Real-time status toast works for both order types.
- **FR-11**: Walk-In Order Mode — after 9 AM cutoff, no slot, best-effort, no Coins.

## Dev Agent Record

### Implementation Plan

1. Updated `src/lib/order-mode.ts` — added `estimateWait` and `coinsInfo` to `OrderMode` type.
2. Updated `MenuItemDetail.tsx` — walk-in "Add to Cart" button shows "(Walk-In)" suffix; enhanced walk-in notice with estimate wait + coins info; 0 Coins warning line.
3. Updated `CartPanel.tsx` — expanded walk-in info box showing "Walk-In Order", estimated wait, and coins info.
4. Updated `OrderConfirmationModal.tsx` — walk-in confirmation shows estimated wait and 0 Coins note.
5. Updated `MenuPageContent.tsx` — walk-in banner uses `Timer` icon instead of `Clock`, shows estimate wait + coins info inline.

### Debug Log

- **Duplicate `</div>`**: Banner replacement left an extra closing tag causing ESLint parsing error. Removed the duplicate.

### Completion Notes

All 7 tasks completed. Walk-in ordering experience now feels distinctly different from pre-order — amber-colored banner with Timer icon, "(Walk-In)" suffix on buttons, estimated wait displayed everywhere, and "Earns 0 Canteen Coins" messaging throughout the flow. Server compiles clean, lint 0 errors. Epic 3 is complete.

## File List

**Modified files:**
- `src/lib/order-mode.ts`: Added `estimateWait`, `coinsInfo` properties to `OrderMode` type.
- `src/components/menu/MenuItemDetail.tsx`: Walk-in button suffix, enhanced walk-in notice, 0 Coins warning.
- `src/components/cart/CartPanel.tsx`: Expanded walk-in info box with estimate wait + coins info.
- `src/components/cart/OrderConfirmationModal.tsx`: Walk-in confirmation with estimate wait + 0 Coins note.
- `src/app/student/home/MenuPageContent.tsx`: `Timer` icon for walk-in banner, inline estimate wait + coins info.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 3, Story 3.6 |
| 2026-08-07 | Implementation complete — all 7 tasks done, all 7 ACs verified |
| 2026-08-07 | Status updated to `review` |
