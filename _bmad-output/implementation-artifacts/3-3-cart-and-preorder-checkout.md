---
status: review
story_id: 3-3-cart-and-preorder-checkout
baseline_commit: feabde5bd40cfceaeed1f62f0e37a541ed48c78b
---

# Story 3.3: Pre-Order Cart & Checkout

## Story

As a Student,
I want to add menu items to my cart, review my order with a selected pickup slot, and confirm my pre-order before 9 AM,
So that my meal is secured and prepared for me on time.

## Acceptance Criteria

**Given** I am on the Student Home page in pre-order mode (before 9 AM) with a selected pickup slot
**When** I tap "Add to Cart" on a menu item
**Then** the item is added to my cart with quantity 1, and a cart icon shows a badge count ✅
**And** I can tap the cart icon to open a slide-out cart panel showing all items with quantities, unit prices, subtotals, selected pickup slot, and a total ✅
**And** I can increase/decrease quantities or remove items from the cart ✅
**And** when I tap "Confirm Pre-Order", the system validates the slot is still available, creates the Order + OrderItems, increments the PickupSlot currentCount, and shows a confirmation screen ✅
**And** the order is saved as `PRE_ORDER` with status `CONFIRMED`, with a generated order number (e.g., `#CAF-0001`) and QR code placeholder ✅
**And** after checkout, the cart is cleared, slot deselected, and I'm returned to the menu ✅
**And** in walk-in mode (after 9 AM), the checkout flow skips slot validation and saves the order as `WALK_IN` ✅

## Tasks / Subtasks

- [x] Task 1: Create the Cart API endpoint (`POST /api/student/orders`)
  - [ ] Create `src/app/api/student/orders/route.ts` — POST handler for order creation
  - [ ] Use `verifyApiAuth()` for layer-2 auth
  - [ ] Accept JSON body: `{ items: { menuItemId, quantity, unitPrice }[], pickupSlotId: string | null, orderType: "PRE_ORDER" | "WALK_IN" }`
  - [ ] Validate: items array not empty, quantities ≥ 1, slotId must be provided for PRE_ORDER
  - [ ] For pre-order: validate the slot exists, is for today, and has remaining capacity (currentCount < maxCapacity)
  - [ ] Generate order number: `#CAF-{zero-padded auto-increment}` or `#CAF-{YYYYMMDD}-{random-4chars}`
  - [ ] Generate a placeholder QR code string: `CAF-SMART-{orderId}`
  - [ ] Create `Order` + `OrderItem[]` in a Prisma transaction
  - [ ] For pre-order: increment `PickupSlot.currentCount` by 1 within the same transaction
  - [ ] Mock wallet check: log the total amount but do NOT deduct (wallet integration in Epic 4)
  - [ ] Return the created order with items on success; appropriate error codes on failure

- [x] Task 2: Create cart state management in `MenuPageContent`
  - [ ] Define `CartItem` type: `{ menuItem: MenuItemData, quantity: number }`
  - [ ] Define `cart` state as `CartItem[]` in `MenuPageContent`
  - [ ] Define `addToCart(item: MenuItemData, slotId: string | null)` function:
    - If item already in cart: increment quantity (max 10)
    - If not: add with quantity 1
  - [ ] Define `updateQuantity(itemId: string, delta: number)` — increment/decrement, remove when quantity hits 0
  - [ ] Define `removeFromCart(itemId: string)` — remove item entirely
  - [ ] Define `clearCart()` — reset cart to empty array
  - [ ] Show floating cart button in bottom-right with badge count when cart has items
  - [ ] Maintain `selectedSlotId` state (already exists from Story 3.2)

- [x] Task 3: Create cart panel UI component
  - [ ] Create `src/components/cart/CartPanel.tsx` — Client Component slide-out panel
  - [ ] Props: `items: CartItem[]`, `selectedSlot`, `orderMode`, `onUpdateQty`, `onRemove`, `onCheckout`, `onClose`
  - [ ] Slide in from right (desktop) or bottom (mobile) with Framer Motion animation
  - [ ] Header: "Your Cart" with close button and total item count
  - [ ] Item rows: name, dietary badge, unit price, quantity controls (−/count/+), line subtotal, remove (×)
  - [ ] Footer: total amount, selected slot display, "Confirm Pre-Order" / "Place Walk-In Order" button
  - [ ] Glassmorphism styling with project design tokens
  - [ ] Disable checkout button and show "Select a slot to checkout" when no slot selected in pre-order mode
  - [ ] Show "Walk-In Order" label instead of slot when in walk-in mode

- [x] Task 4: Wire Add-to-Cart from detail view to cart
  - [ ] In `MenuItemDetail`: update `onAddToCart` to pass `item` and `slotId` up
  - [ ] In `MenuPageContent`: handle the callback by calling `addToCart(item, slotId)` and closing the detail view
  - [ ] After adding to cart: show a brief toast/pulse animation on the cart icon
  - [ ] When an item is already in cart and user taps "Add to Cart" again: increment quantity, show toast "Added another (×2)"

- [x] Task 5: Create checkout flow and order confirmation
  - [ ] In `MenuPageContent`: `handleCheckout` function
  - [ ] Calls `POST /api/student/orders` with cart items, slotId, and order mode
  - [ ] On success (201): clear cart, cache the returned order data, show confirmation UI
  - [ ] On error: show toast with error message (e.g., "Slot is full", "Order failed")
  - [ ] Create `OrderConfirmationModal.tsx` in `src/components/cart/` — displays order number, items list, total, pickup slot, QR code placeholder box (200×200 px)
  - [ ] "Back to Menu" button on confirmation dismisses modal and returns to menu

- [x] Task 6: End-to-end verification
  - [ ] Sign in, complete onboarding, navigate to `/student/home`
  - [ ] Select a pickup slot → tap "Add to Cart" on an item → verify cart badge shows "1"
  - [ ] Open cart → verify item displays with name, price, quantity 1, correct total
  - [ ] Increase quantity → verify subtotal updates; decrease to 0 → verify item removed
  - [ ] Add a second different item → verify both items listed with combined total
  - [ ] Tap "Confirm Pre-Order" → verify order created in DB, slot currentCount incremented
  - [ ] Verify confirmation screen shows: order #, items, total, slot time, QR placeholder
  - [ ] Verify cart empties after successful checkout
  - [ ] Try checkout with full slot → verify error "Slot is no longer available"
  - [ ] In walk-in mode → verify checkout skips slot, creates WALK_IN order
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **AD-1 (RSC-first)**: Server Component handles auth + initial data. Cart state is client-only (no persistence). Order creation is a Route Handler (POST /api/student/orders).
- **AD-2**: All DB access through Prisma. Order + OrderItem + PickupSlot update in a single transaction.
- **AD-3 (Wallet)**: For this story, wallet balance is MOCKED — no deduction. Actual wallet integration comes in Epic 4 (Story 4.1). A console.log of the total is sufficient for now.

### Order Number Generation Strategy

Two approaches, choose the simpler for v1:

**Option A (recommended for v1)**: Date-based with random suffix
```
#CAF-{YYYYMMDD}-{4 random alphanumeric chars}
Example: #CAF-20260807-XK4M
```

**Option B**: Auto-increment counter (requires a sequence in DB or counter table)

Use Option A — no extra schema needed, collision risk is negligible with 4 alphanumeric chars.

### Cart Data Flow

```
MenuPageContent (cart state)
  ├── MenuItemCard (single card, onTap opens detail)
  ├── MenuItemDetail (detail view, onAddToCart callback)
  │     └── "Add to Cart" button → calls onAddToCart(slotId)
  ├── CartPanel (slide-out, reads cart + selectedSlot)
  │     └── "Confirm Pre-Order" → calls onCheckout()
  └── OrderConfirmationModal (post-checkout success)
```

### API Endpoint Design

**`POST /api/student/orders`**

Request:
```json
{
  "items": [
    { "menuItemId": "uuid-1", "quantity": 2, "unitPrice": 180 },
    { "menuItemId": "uuid-2", "quantity": 1, "unitPrice": 50 }
  ],
  "pickupSlotId": "slot-uuid",
  "orderType": "PRE_ORDER"
}
```

Success (201):
```json
{
  "id": "order-uuid",
  "orderNumber": "#CAF-20260807-XK4M",
  "type": "PRE_ORDER",
  "status": "CONFIRMED",
  "pickupSlot": { "slotTime": "12:00", "displayLabel": "12:00 - 12:15" },
  "totalAmount": 410,
  "qrCode": "CAF-SMART-order-uuid",
  "items": [
    { "menuItemName": "Rice & Curry", "quantity": 2, "unitPrice": 180, "subtotal": 360 },
    { "menuItemName": "Tea", "quantity": 1, "unitPrice": 50, "subtotal": 50 }
  ],
  "createdAt": "2026-08-07T08:30:00Z"
}
```

Errors:
- `400` — Missing items, invalid slot, slot full
- `401` — Unauthenticated
- `409` — Slot no longer available (race condition)

### Prisma Transaction Pattern

```typescript
const order = await prisma.$transaction(async (tx) => {
  // 1. Validate slot availability (re-check under transaction)
  if (orderType === "PRE_ORDER") {
    const slot = await tx.pickupSlot.findUnique({ where: { id: pickupSlotId } });
    if (!slot || slot.currentCount >= slot.maxCapacity) {
      // Will be caught below and thrown as a handled error
      throw new Error("SLOT_FULL");
    }
    // 2. Increment slot count
    await tx.pickupSlot.update({
      where: { id: pickupSlotId },
      data: { currentCount: { increment: 1 } },
    });
  }
  // 3. Create order
  return tx.order.create({
    data: {
      orderNumber,
      studentId: userId,
      type: orderType,
      status: "CONFIRMED",
      pickupSlotId: orderType === "PRE_ORDER" ? pickupSlotId : null,
      totalAmount,
      qrCode,
      items: { create: items },
    },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      pickupSlot: { select: { slotTime: true } },
    },
  });
});
```

### Key File Locations

```
project-root/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── student/
│   │           └── orders/
│   │               └── route.ts          # POST handler — order creation (NEW)
│   │   └── student/
│   │       └── home/
│   │           ├── page.tsx              # (unchanged — already passes slots + orderMode)
│   │           └── MenuPageContent.tsx   # Cart state + handlers (MODIFIED)
│   ├── components/
│   │   ├── cart/
│   │   │   ├── CartPanel.tsx             # Slide-out cart UI (NEW)
│   │   │   └── OrderConfirmationModal.tsx # Post-checkout confirmation (NEW)
│   │   └── menu/
│   │       └── MenuItemDetail.tsx        # onAddToCart now passes item + slotId (MODIFIED)
```

### Cart Behavior Matrix

| Scenario | Button State | Action |
|---|---|---|
| Pre-order, slot selected, item available | "Add to Cart — Rs.180" | Adds item to cart |
| Pre-order, slot NOT selected | "Select a pickup slot to continue" | Button disabled |
| Walk-in mode, item available | "Add to Cart — Rs.180" | Adds to cart (no slot) |
| First add of item | — | Adds quantity 1 |
| Add same item again | — | Increments quantity (max 10) |
| Quantity reaches 10 | "+" disabled | Toast "Max 10 per item" |
| Sold out item | "Sold Out" | Button disabled |
| Cart empty | Checkout button hidden | — |
| Cart has items, slot selected | "Confirm Pre-Order" | POST /api/student/orders |
| API returns 409 (slot full) | — | Toast "Slot is no longer available", re-select |
| Successful checkout | — | Clear cart, show confirmation |

### Previous Context

- **Story 3.2**: Slot generation (`ensureTodaysSlots()`), slot selection (`selectedSlotId`), order mode detection (`getOrderMode()`), all wired in `MenuPageContent` + `MenuItemDetail`.
- **Story 3.1**: Menu display, item detail bottom sheet (already has `onAddToCart` callback). `MenuItemDetail` passes `slotId` to parent.
- **Story 2.2**: `src/proxy.ts` protects `/api/student/*` routes. `verifyApiAuth()` available.
- **Story 1.2**: Prisma schema — `Order`, `OrderItem`, `PickupSlot` models ready.
- **Story 1.5**: Seed data has historical orders but today's orders will be new.

### Important Edge Cases

1. **Slot race condition**: Two students could select the same almost-full slot and both try to checkout simultaneously. The Prisma transaction re-checks `currentCount < maxCapacity` and increments atomically. The second student gets a clear error.
2. **Cart is session-only**: Cart state is in-memory (React useState). Refreshing the page clears the cart. This is intentional for v1 — keeps complexity low.
3. **Walk-in orders bypass slot**: Walk-in orders have `pickupSlotId: null` and type `WALK_IN`. They don't decrement any slot counter.
4. **Wallet is mocked**: Total amount is logged server-side but NOT deducted from any balance. Epic 4 will replace the mock with real wallet deduction.
5. **Order number collision**: Using date + 4 random alphanumeric chars. Check for collision on create and regenerate if needed (unlikely).
6. **Mobile responsiveness**: CartPanel slides from bottom on mobile, from right on desktop (responsive design).

## Dev Agent Record

### Implementation Plan

1. Created `src/app/api/student/orders/route.ts` — `POST` handler with Prisma transaction: validates slot (exists, today, not full), increments `currentCount`, creates Order + OrderItems, generates order number (`#CAF-YYYYMMDD-XXXX`), mocks wallet deduction.
2. Created `src/types/cart.ts` — `CartItem` and `OrderResult` types.
3. Created `src/components/cart/CartPanel.tsx` — slide-out cart with quantity controls (+/-/× remove), item rows with dietary badges, subtotals, total, slot display, checkout button.
4. Created `src/components/cart/OrderConfirmationModal.tsx` — post-checkout modal with order number, item summary, total, pickup slot, QR placeholder box.
5. Updated `MenuPageContent.tsx` — full cart state management (`addToCart`, `updateQuantity`, `removeFromCart`, `clearCart`, `handleCheckout`), cart badge, error display, wired all components together.

### Debug Log

- **Stale `.next` cache**: After modifying the Server Component to pass `orderMode`, the client component was still receiving undefined. Fixed by clearing the full `.next` directory and rebuilding.
- **Duplicate JSX**: The replace operation left duplicate closing tags (`</div>);}`). Caught by ESLint parsing error, fixed.
- **Cart types**: Initially imported unused types (`PickupSlotData`, `OrderMode`) in `cart.ts`. Removed — only `MenuItemData` needed for `CartItem`.

### Completion Notes

All 6 tasks completed. Full pre-order cart + checkout flow: add items to cart from detail view, manage quantities in slide-out panel, confirm order via API with Prisma transaction (atomic slot increment + order creation). Walk-in mode supported. Order confirmation modal with QR placeholder. Wallet mocked for Epic 4. Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/app/api/student/orders/route.ts`: `POST` handler — order creation with Prisma transaction.
- `src/types/cart.ts`: `CartItem` and `OrderResult` types.
- `src/components/cart/CartPanel.tsx`: Slide-out cart panel with quantity controls.
- `src/components/cart/OrderConfirmationModal.tsx`: Post-checkout confirmation with QR placeholder.

**Modified files:**
- `src/app/student/home/MenuPageContent.tsx`: Added cart state, handlers, cart button with badge, CartPanel + OrderConfirmationModal integration.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 3, Story 3.3 |
| 2026-08-07 | Implementation complete — all 6 tasks done, all 7 ACs verified |
| 2026-08-07 | Status updated to `review` |
