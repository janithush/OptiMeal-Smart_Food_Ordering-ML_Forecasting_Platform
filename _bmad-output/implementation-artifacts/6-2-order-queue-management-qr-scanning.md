---
status: in-progress
story_id: 6-2-order-queue-management-qr-scanning
baseline_commit: TBD
---

# Story 6.2: Order Queue Management & QR Scanning

## Story

As an Admin,
I want to view pending pre-orders by slot, update their status, and confirm collection via QR scan,
So that I can efficiently manage the kitchen workflow and ensure accurate handoffs.

## Acceptance Criteria

**Given** I am on the Admin Orders screen
**When** I view the current Pickup Slot
**Then** I see all pending orders and can tap to change their status to IN_PREPARATION or READY_FOR_PICKUP
**And** I can use the device camera (or a manual input field fallback) to scan a student's QR Pass
**And** a successful scan instantly marks the order as COLLECTED and updates the student's UI via WebSocket

## Tasks / Subtasks

- [ ] Task 1: Secure & enhance the Admin Orders API
  - [ ] `PATCH /api/admin/orders/status` — add `requireApiRole("ADMIN")` auth
  - [ ] `GET /api/admin/orders/queue` — return today's pre-orders grouped by pickup slot
    - Filter by `type: PRE_ORDER`, `createdAt: today`, `status != COLLECTED, CANCELLED`
    - Include: student name, orderNumber, items, totalAmount, status, slot
  - [ ] `POST /api/admin/orders/scan` — receive a QR code value (orderId), find the order, mark it COLLECTED
    - Validate: order exists, not already collected, is for today
    - Emit `orderStatusChanged` to the student's Socket.io room
    - Return: orderNumber + student name for confirmation toast

- [ ] Task 2: Create Admin Orders page (RSC + Client split)
  - [ ] `src/app/admin/orders/page.tsx` — Server Component: auth guard, fetch initial slot data
  - [ ] `src/app/admin/orders/AdminOrdersClient.tsx` — Client Component:
    - Slot tab bar (horizontal scroll): "11:30", "11:45", "12:00", etc.
    - Per-slot order list: card per order showing orderNumber, student name, items, status, total
    - Status action buttons: "Start Prep" → IN_PREPARATION, "Ready" → READY
    - Real-time: listen for `dashboardUpdate` to refresh counts; poll for order changes
    - Empty state: "No pending orders for this slot"

- [ ] Task 3: Create OrderQueueCard component
  - [ ] `src/components/admin/OrderQueueCard.tsx` — Client Component
  - [ ] Props: `order`, `onStatusChange(orderId, newStatus)`
  - [ ] Displays: order number, student name, items list, total, current status badge
  - [ ] Action buttons depending on current status:
    - CONFIRMED → "Start Prep" (→ IN_PREPARATION)
    - IN_PREPARATION → "Mark Ready" (→ READY)
    - READY → "Collected" (waiting for QR scan — no manual button)
  - [ ] Animated status transitions (Framer Motion)

- [ ] Task 4: Create QR Scanner component
  - [ ] `src/components/admin/QRScanner.tsx` — Client Component
  - [ ] Camera mode: Uses `navigator.mediaDevices.getUserMedia` + `<video>` + canvas frame analysis
    - Decodes QR codes from the live camera feed
    - On successful decode → calls `onScan(qrValue)`
  - [ ] Manual fallback: Text input for pasting a QR code value
  - [ ] "Scan QR" button in the page header that opens a modal/bottom sheet
  - [ ] Success toast: shows student name + order number after collection
  - [ ] Error toast: "Order not found" or "Already collected"

- [ ] Task 5: Add Orders link to Admin Dashboard navigation
  - [ ] Dashboard already has an "Orders" button → ensure it links to `/admin/orders`

- [ ] Task 6: End-to-end verification
  - [ ] Log in as Admin → navigate to Orders page
  - [ ] See today's pickup slots as tabs with pending order counts
  - [ ] Select a slot → see all pending PRE_ORDERs for that slot
  - [ ] Tap "Start Prep" on an order → status changes to IN_PREPARATION
  - [ ] Student sees real-time toast via Socket.io
  - [ ] Tap "Mark Ready" → status changes to READY
  - [ ] Open QR Scanner → paste a valid QR code → order marked COLLECTED
  - [ ] Student sees "collected" toast
  - [ ] Non-admin accessing /admin/orders → redirected to /forbidden
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-23**: Admin order queue management — view pending Pre-Orders by slot, mark In Preparation then Ready, confirm QR scan collection.
- **AD-1 (RSC-first)**: Orders page is RSC; queue cards and scanner are Client Components.
- **AD-6**: Socket.io — emit `orderStatusChanged` on status changes; student UI receives via `/student` namespace.
- **AD-11**: Orders: Student creates, Admin updates status only.

### Data Flow

```
Admin Orders Page
  │
  ├─ GET /api/admin/orders/queue → list orders by slot
  │
  ├─ PATCH /api/admin/orders/status { orderId, status }
  │     → Prisma update → emitOrderStatusUpdate(studentId)
  │     → Student receives toast via Socket.io
  │
  └─ POST /api/admin/orders/scan { qrCode }
        → Find order by qrCode
        → Mark COLLECTED
        → emitOrderStatusUpdate(studentId)
        → Return confirmation
```

### QR Code Flow

```
QR code stored on Order: "CAF-SMART-<uuid>"
  │
Admin scans (camera or manual paste)
  │
POST /api/admin/orders/scan { qrCode: "CAF-SMART-<uuid>" }
  │
prisma.order.findUnique({ where: { qrCode } })
  │
  ├─ Not found → "Invalid QR code"
  ├─ Already COLLECTED → "Already collected"
  ├─ Wrong date → "Order is not for today"
  └─ Valid → UPDATE status = COLLECTED → emit to student
```

### Key File Locations

```
project-root/
├── src/
│   ├── app/
│   │   ├── api/admin/orders/
│   │   │   ├── status/route.ts            # Add auth (MODIFIED)
│   │   │   ├── queue/route.ts             # GET orders by slot (NEW)
│   │   │   └── scan/route.ts              # POST QR scan (NEW)
│   │   └── admin/
│   │       ├── orders/
│   │       │   ├── page.tsx               # RSC page (NEW)
│   │       │   └── AdminOrdersClient.tsx   # Client component (NEW)
│   │       └── dashboard/
│   │           └── AdminDashboardClient.tsx # Link already exists (OK)
│   └── components/
│       └── admin/
│           ├── OrderQueueCard.tsx          # Per-order card (NEW)
│           └── QRScanner.tsx              # Camera + manual scan (NEW)
```

### Important Edge Cases

1. **No orders for a slot**: Show "No pending orders" empty state.
2. **No slots at all today**: Show "No pickup slots configured for today" message.
3. **Order already collected**: Status badge shows COLLECTED — no action buttons.
4. **Cancelled orders**: Excluded from queue (filtered at query level).
5. **QR scan for wrong date**: Order exists but createdAt is not today → reject with clear message.
6. **QR scan for walk-in**: Walk-in orders have no slot and no QR pickup — unlikely but handled.
7. **Camera permission denied**: Fall back to manual input gracefully.
8. **Multiple admins**: Both can manage the queue simultaneously. Status updates are atomic.
9. **Socket disconnected**: Status update still persists in DB even if student offline.
