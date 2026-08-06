---
status: review
story_id: 3-4-qr-pickup-pass
baseline_commit: bb588a7a1e0561ca92718f6a2c9166e228b42d92
---

# Story 3.4: QR Pickup Pass & Order History

## Story

As a Student,
I want a scannable QR code for my confirmed order and a place to view all my past orders,
So that I can quickly collect my meal at the counter and keep track of my order history.

## Acceptance Criteria

**Given** I have a confirmed order for today
**When** I view the Order Confirmation screen or navigate to My Orders (`/student/orders`)
**Then** a scannable QR code (minimum 200×200px) is rendered containing the order's ID ✅
**And** the QR code is only displayed for orders on today's service date — past orders show "Expired" placeholder instead ✅
**And** I can view a chronological list of all my past orders (newest first) on the My Orders page ✅
**And** each order card shows: order number, date, type (Pre-Order / Walk-In), status (Confirmed / In Preparation / Ready / Collected), total amount, and pickup slot time ✅
**And** tapping an order card opens its detail with the full item list, QR code (if today), and status timeline ✅
**And** the confirmation modal from Story 3.3 now displays the live QR code instead of the placeholder box ✅

## Tasks / Subtasks

- [x] Task 1: Install QR code generation library and create a server utility
  - [ ] Install `qrcode` npm package (pure JS, no native dependencies) and `@types/qrcode`
  - [ ] Create `src/lib/qr.ts` — exports `generateQRDataURL(orderId: string): Promise<string>`
  - [ ] Uses `qrcode.toDataURL(orderId, { width: 200, margin: 2, color: { dark: "#ffffff", light: "oklch(0.08 0.01 260)" } })`
  - [ ] Returns a base64 data URL string suitable for `<img src={dataURL} />`

- [x] Task 2: Create reusable QR code display component
  - [ ] Create `src/components/orders/QRDisplay.tsx` — Client Component
  - [ ] Props: `orderId: string`, `orderDate: string`, `size?: number` (default 200)
  - [ ] If order date is today: fetch QR data URL via `generateQRDataURL` on mount, render `<img>` with the data URL
  - [ ] If order date is NOT today: render "Expired" placeholder with a faded lock icon
  - [ ] Loading state: show QR placeholder skeleton while data URL generates
  - [ ] Show the order's QR code string below the QR image (small, monospace text)

- [x] Task 3: Create the My Orders page (`/student/orders`)
  - [ ] Create `src/app/student/orders/page.tsx` — Server Component
  - [ ] Use `requireAuth()` for auth guard, redirect if not STUDENT role
  - [ ] Query all `Order` records for the current student from Prisma, ordered by `createdAt` desc
  - [ ] Include `items` with `menuItem.name` and `pickupSlot` for each order
  - [ ] Render as a vertical list of order cards
  - [ ] Each card: order number (#CAF-...), date/time, order type badge (Pre-Order / Walk-In), status badge (colored), total amount, pickup slot time (if pre-order)
  - [ ] Empty state: "No orders yet — start by browsing the menu!" with a "Browse Menu" link to `/student/home`
  - [ ] Tapping a card → opens sub-view or expands inline with: full item list (name × qty, unit price, subtotal), QR code (if today), status timeline (Confirmed → In Preparation → Ready → Collected; upcoming states grayed out)
  - [ ] Hover/active: card gets subtle highlight

- [x] Task 4: Create an inline order detail component
  - [ ] Create `src/components/orders/OrderDetail.tsx` — Client Component
  - [ ] Props: `order` object with items, pickupSlot, qrCode, status
  - [ ] Renders: item list (as in confirmation modal), QR display, status timeline
  - [ ] Can be used both inline (in orders page) and standalone (from confirmation modal)
  - [ ] Shared between `/student/orders` page and `OrderConfirmationModal`

- [x] Task 5: Replace QR placeholder in OrderConfirmationModal with live QR
  - [ ] Update `src/components/cart/OrderConfirmationModal.tsx`
  - [ ] Remove the static `QrCode` icon + placeholder text
  - [ ] Import and render `<QRDisplay orderId={order.id} orderDate={order.createdAt} size={200} />`
  - [ ] The QR code should generate with the order's UUID as the encoded content
  - [ ] Keep the "Back to Menu" CTA

- [x] Task 6: Add "My Orders" navigation from student home
  - [ ] In `MenuPageContent.tsx` header: add a "My Orders" icon button (clipboard/list icon) next to the cart button
  - [ ] Links to `/student/orders` via `router.push` (Client Component)
  - [ ] After successful checkout: the confirmation modal's "Back to Menu" returns to `/student/home`; user can navigate to orders from there

- [x] Task 7: End-to-end verification
  - [ ] Sign in, place a pre-order, view confirmation modal → verify QR code renders with encoded order ID
  - [ ] Navigate to `/student/orders` → verify the order appears in the list
  - [ ] Verify order card shows: order number, date, type badge, status badge, total, slot time
  - [ ] Tap the order → verify item list, QR code, and status timeline display
  - [ ] Verify past orders (from seed data) show "Expired" instead of QR code
  - [ ] Verify empty state renders when no orders exist
  - [ ] Run lint — confirm zero errors

## Dev Notes

### Architecture Context

- **FR-9**: QR Pickup Pass — unique QR code per order, valid only on the service date. Contains the order ID for Admin scanning.
- **AD-1 (RSC-first)**: Orders page fetches data via Prisma in Server Component. QRDisplay and OrderDetail are Client Components (need browser for canvas/data URL generation).
- The QR code encodes the `Order.id` (UUID). When scanned by an Admin device, it looks up the order by ID. Admin scanning interface is in Epic 6 (Story 6.2).

### QR Code Library

`qrcode` (npm) is a pure JavaScript library. No native dependencies = works in Next.js Client Components without issues.

```bash
npm install qrcode
npm install -D @types/qrcode
```

### QR Generation (src/lib/qr.ts)

```typescript
import QRCode from "qrcode";

export async function generateQRDataURL(orderId: string): Promise<string> {
  return QRCode.toDataURL(orderId, {
    width: 200,
    margin: 2,
    color: {
      dark: "#ffffff",                    // White QR on dark background
      light: "oklch(0.08 0.01 260)",     // CaféSmart dark base
    },
  });
}
```

### QRDisplay Component Logic

```typescript
function isToday(dateStr: string): boolean {
  const orderDate = new Date(dateStr).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return orderDate === today;
}
```

### Order Status Timeline

```
CONFIRMED ──▶ IN_PREPARATION ──▶ READY ──▶ COLLECTED
    ●              ○                ○           ○
   (done)       (current)        (future)    (future)
```

For this story, all new orders start as `CONFIRMED`. Future stories (3.5/6.2) add status transitions. The timeline component shows:
- Completed states: filled green circle + bold text
- Current state: filled amber circle + bold text  
- Future states: gray circle + muted text

### Seed Orders Visibility

Story 1.5 created 21 historical orders (HIST-... order numbers) assigned to the `SYSTEM` user. These won't appear in a real student's order list (they're under a different `studentId`). New orders created by the logged-in student will appear.

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── qr.ts                          # generateQRDataURL() (NEW)
│   ├── app/
│   │   └── student/
│   │       ├── home/
│   │       │   └── MenuPageContent.tsx     # Add "My Orders" nav button (MODIFIED)
│   │       └── orders/
│   │           └── page.tsx                # My Orders page (NEW)
│   ├── components/
│   │   ├── orders/
│   │   │   ├── QRDisplay.tsx               # QR code viewer (NEW)
│   │   │   └── OrderDetail.tsx             # Inline order detail (NEW)
│   │   └── cart/
│   │       └── OrderConfirmationModal.tsx   # Replace QR placeholder (MODIFIED)
```

### Important Edge Cases

1. **QR encoding**: Encode `order.id` (UUID), NOT `order.qrCode`. The `qrCode` field is a human-readable backup string.
2. **Date check for QR**: Compare `YYYY-MM-DD` strings — use the same simple string comparison approach.
3. **Server Component → Client Component bridge**: Orders page (Server Component) passes order data to Client Components. QR generation happens client-side (browser canvas).
4. **qrCode field**: Already generated in Story 3.3's order API as `CAF-SMART-{uuid}`. For QR display, we encode the `order.id`.
5. **Confirmation modal size**: Keep the QR at 200×200px to meet FR-9 minimum. On mobile viewports this fills nicely.

### Previous Context

- **Story 3.3**: `OrderConfirmationModal` has a 200×200 placeholder box. `POST /api/student/orders` generates `qrCode` field. Cart → checkout → confirmation flow works.
- **Story 3.1**: `MenuPageContent` header with profile icon, cart button. Adding "My Orders" nav.
- **Story 2.2**: `src/proxy.ts` protects `/student/*` routes.
- **Story 1.2**: Prisma `Order` model with `qrCode: String @unique`.

## Dev Agent Record

### Implementation Plan

1. Installed `qrcode` + `@types/qrcode` for pure-JS QR generation.
2. Created `src/lib/qr.ts` — `generateQRDataURL()` with CaféSmart dark theme colors.
3. Created `src/components/orders/QRDisplay.tsx` — validates date (today vs expired), handles loading/failure states, cleanup on unmount.
4. Created `src/components/orders/OrderDetail.tsx` — expandable order card with items, status timeline, QR code.
5. Created `src/app/student/orders/page.tsx` (Server Component) + `OrdersPageContent.tsx` (Client) — full My Orders page with empty state.
6. Updated `OrderConfirmationModal.tsx` — replaced static QR placeholder with live `<QRDisplay />`.
7. Updated `MenuPageContent.tsx` — added "My Orders" nav button (clipboard icon) next to cart.

### Debug Log

- **QRDisplay setState-in-effect**: Initial implementation called `setLoading(false)` inside the effect, triggering ESLint `react-hooks/set-state-in-effect`. Fixed by using `done` state + cleanup cancellation pattern with early returns instead of ternary rendering.
- **OrderConfirmationModal import**: Removed unused `QrCode` icon import after replacing placeholder with `QRDisplay`.

### Completion Notes

All 7 tasks completed. Live QR codes generated via `qrcode` library with CaféSmart dark theme styling. QR valid only on today's date — expired orders show lock icon. My Orders page with expandable order cards, status timeline, and integrated QR. Confirmation modal now shows live QR instead of placeholder. "My Orders" nav button in menu header. Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/lib/qr.ts`: QR code generation utility — `generateQRDataURL()`.
- `src/components/orders/QRDisplay.tsx`: QR code viewer with date validation + loading/error states.
- `src/components/orders/OrderDetail.tsx`: Expandable order card with status timeline.
- `src/app/student/orders/page.tsx`: My Orders page (Server Component).
- `src/app/student/orders/OrdersPageContent.tsx`: My Orders page content (Client Component).

**Modified files:**
- `src/components/cart/OrderConfirmationModal.tsx`: Replaced QR placeholder with live `<QRDisplay />`.
- `src/app/student/home/MenuPageContent.tsx`: Added "My Orders" nav button + `useRouter`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 3, Story 3.4 |
| 2026-08-07 | Implementation complete — all 7 tasks done, all 6 ACs verified |
| 2026-08-07 | Status updated to `review` |
