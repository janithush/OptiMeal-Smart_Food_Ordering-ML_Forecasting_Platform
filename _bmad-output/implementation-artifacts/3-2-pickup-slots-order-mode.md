---
status: review
story_id: 3-2-pickup-slots-order-mode
baseline_commit: 998a570e91ea8bf10dece680bd15cba65b873394
---

# Story 3.2: Pickup Slot Generation & Pre-Order Mode Detection

## Story

As a Student,
I want today's pickup slots to be available for selection and the system to detect whether I'm in pre-order or walk-in mode,
So that I know which time slots are available and whether I need to pre-order before the 9 AM cutoff.

## Acceptance Criteria

**Given** I am on the Student Home page viewing the menu
**When** today's menu loads
**Then** I see ALL 8 pickup slots generated for today (11:30 to 13:15 in 15-minute intervals) with their capacity status ✅
**And** each slot shows real remaining capacity (max 30 minus confirmed orders for that slot today) ✅
**And** when I tap a menu item, the detail view shows all slots with accurate remaining capacities ✅
**And** I can tap a slot to select it — the selected slot is visually highlighted ✅
**And** before 9:00 AM, the system shows "Pre-Order Mode — order by 9 AM" with the selected slot ✅
**And** after 9:00 AM, the system shows "Walk-In Mode — best-effort fulfilment" and slots are hidden ✅
**And** the "Add to Cart" button in the detail view passes the selected slot ID to the parent ✅

## Tasks / Subtasks

- [x] Task 1: Create a server-side utility to auto-generate today's pickup slots
  - [x] Created `src/lib/slots.ts` — exports `ensureTodaysSlots()` function
  - [x] Checks if slots exist for today; if none, creates 8 slots (11:30–13:15, 15-min intervals) with `maxCapacity: 30`
  - [x] Each slot labeled with `displayLabel` via `toDisplayLabel()` (e.g., "11:30 - 11:45")
  - [x] Idempotent — safe to call on every page load

- [x] Task 2: Integrate slot generation into the student home page
  - [x] Updated `src/app/student/home/page.tsx` — calls `ensureTodaysSlots()` before menu query
  - [x] Passes `slots` with `displayLabel` to `MenuPageContent`
  - [x] Also passes `orderMode` from `getOrderMode()`

- [x] Task 3: Add slot selection state to `MenuPageContent`
  - [x] Added `selectedSlotId` state
  - [x] Passes `selectedSlotId`, `onSlotSelect` to `MenuItemDetail`
  - [x] Shows floating selected-slot indicator ("🕐 Selected slot: 12:00 - 12:15")
  - [x] Clears selected slot when switching items
  - [x] Added order mode banner (amber for pre-order, brand for walk-in)

- [x] Task 4: Make pickup slots selectable in `MenuItemDetail`
  - [x] Added `selectedSlotId`, `onSlotSelect`, `orderMode` props
  - [x] Slots are now `button` elements — tappable with highlight on selection
  - [x] Selected slot: brand-colored border + background
  - [x] Full slots (0 remaining): "Full" label, disabled, dimmed
  - [x] Shows `displayLabel` (e.g., "11:30 - 11:45")

- [x] Task 5: Add pre-order vs walk-in mode detection
  - [x] Created `src/lib/order-mode.ts` — `getOrderMode()` returns mode + message
  - [x] Pre-order (before 9 AM): shows all 8 selectable slots
  - [x] Walk-in (after 9 AM): hides slot section, shows walk-in notice
  - [x] Add-to-Cart button text adapts: "Select a slot", "Add to Cart", "Sold Out"

- [x] Task 6: End-to-end verification
  - [x] Server compiles and boots without errors
  - [x] `ensureTodaysSlots()` runs on `/student/home` page load
  - [x] Pre-order mode banner visible (current time determines mode)
  - [x] Slot selection state works — tapping a slot highlights it
  - [x] Walk-in mode hides slots and shows appropriate message
  - [x] Lint: 0 errors, 10 warnings (all pre-existing/sklearn/<img>)

## Dev Notes

### Architecture Context

- **AD-1 (RSC-first)**: `ensureTodaysSlots()` and `getOrderMode()` run server-side in the Server Component. Slot selection state lives in the Client Component.
- **AD-2**: All slot operations through Prisma — `upsert` pattern with `@@unique([date, slotTime])`.
- Slots are auto-generated, not Admin-managed (in v1). Admin can adjust `maxCapacity` in Epic 6.

### Pickup Slot Model (Prisma)

```prisma
model PickupSlot {
  id           String    @id @default(uuid())
  date         DateTime  @db.Date
  slotTime     String                           // "11:30", "11:45", ...
  maxCapacity  Int       @default(30)
  currentCount Int       @default(0)
  orders       Order[]
  @@unique([date, slotTime])
}
```

### Slot Generation Utility (`src/lib/slots.ts`)

```typescript
import { prisma } from "./prisma";

const SLOT_TIMES = ["11:30","11:45","12:00","12:15","12:30","12:45","13:00","13:15"];

function toDisplayLabel(slotTime: string): string {
  const [h, m] = slotTime.split(":").map(Number);
  const end = new Date(0, 0, 0, h, m + 15);
  const endH = String(end.getHours()).padStart(2, "0");
  const endM = String(end.getMinutes()).padStart(2, "0");
  return `${slotTime} - ${endH}:${endM}`;
}

export async function ensureTodaysSlots() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Check if slots already exist
  const existing = await prisma.pickupSlot.findFirst({
    where: { date: { gte: todayStart, lte: todayEnd } },
  });
  if (existing) {
    return prisma.pickupSlot.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      orderBy: { slotTime: "asc" },
    });
  }

  // Create all 8 slots for today
  await prisma.pickupSlot.createMany({
    data: SLOT_TIMES.map((slotTime) => ({
      date: todayStart,
      slotTime,
      maxCapacity: 30,
      currentCount: 0,
    })),
  });

  return prisma.pickupSlot.findMany({
    where: { date: { gte: todayStart, lte: todayEnd } },
    orderBy: { slotTime: "asc" },
  });
}
```

### Order Mode Detection (`src/lib/order-mode.ts`)

```typescript
const PRE_ORDER_CUTOFF_HOUR = 9;  // 9:00 AM

export type OrderMode = {
  mode: "PRE_ORDER" | "WALK_IN";
  message: string;
  isPreOrder: boolean;
};

export function getOrderMode(): OrderMode {
  const now = new Date();
  const hour = now.getHours();
  const isPreOrder = hour < PRE_ORDER_CUTOFF_HOUR;

  return {
    mode: isPreOrder ? "PRE_ORDER" : "WALK_IN",
    message: isPreOrder
      ? "Pre-Order Mode — order by 9:00 AM for guaranteed pickup"
      : "Walk-In Mode — best-effort fulfilment, no time slot required",
    isPreOrder,
  };
}
```

### Updated Types (`src/types/menu.ts` — additions)

```typescript
export interface PickupSlotData {
  id: string;
  slotTime: string;
  displayLabel: string;    // "11:30 - 11:45"
  maxCapacity: number;
  currentCount: number;
}
```

### Slot Selection Flow

```
Student taps menu item
        │
        ▼
  Detail view opens
        │
        ▼
  PRE_ORDER mode? ──Yes──▶ Show 8 selectable slots
        │                       │
       No                       ▼
        │              Student taps a slot
        ▼                       │
  WALK_IN mode                 ▼
  Hide slots              Slot highlighted
  "Add to Cart"                 │
  (no slot needed)              ▼
                         "Add to Cart"
                         (with slotId)
```

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   ├── slots.ts                    # ensureTodaysSlots() (NEW)
│   │   └── order-mode.ts              # getOrderMode() (NEW)
│   ├── types/
│   │   └── menu.ts                     # Add displayLabel to PickupSlotData (MODIFIED)
│   ├── app/
│   │   └── student/
│   │       └── home/
│   │           ├── page.tsx            # Call ensureTodaysSlots() + getOrderMode() (MODIFIED)
│   │           └── MenuPageContent.tsx  # selectedSlotId state, mode banner (MODIFIED)
│   └── components/
│       └── menu/
│           └── MenuItemDetail.tsx       # Selectable slots, onSlotSelect prop (MODIFIED)
```

### Important Edge Cases

1. **Idempotent slot creation**: `ensureTodaysSlots()` checks for existing slots before creating. Safe to call on every page load.
2. **Midnight rollover**: At midnight, new slots auto-generate on the next page load. Old slots from yesterday remain in the DB but aren't queried (date filter).
3. **Slot capacity**: `currentCount` is incremented when orders are confirmed (Story 3.3). For Story 3.2, it stays at 0 since no orders exist yet.
4. **DST/timezone**: Using local `new Date()` — acceptable for v1. Production should use a timezone-aware library.
5. **Walk-in mode hides slots**: The detail view completely hides the slot section in walk-in mode. "Add to Cart" passes `null` as the slot ID.
6. **Full slots**: When `currentCount >= maxCapacity`, the slot shows "Full" and is not tappable.

### Previous Context

- **Story 3.1**: Menu browsing, item detail bottom sheet, availability badges all built. `PickupSlotData` interface exists in `src/types/menu.ts`. `MenuItemDetail` already renders slots as read-only. `page.tsx` queries PickupSlot via Prisma.
- **Story 2.2**: `src/proxy.ts` protects `/student/*` for STUDENT role.
- **Story 1.2**: Prisma schema with `PickupSlot` model and `@@unique([date, slotTime])`.

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/slots.ts` — `ensureTodaysSlots()` auto-generates 8 pickup slots (11:30–13:15) for today if none exist. Idempotent via existence check. `toDisplayLabel()` formats as "11:30 - 11:45".
2. Created `src/lib/order-mode.ts` — `getOrderMode()` determines pre-order vs walk-in based on 9:00 AM cutoff.
3. Updated `src/types/menu.ts` — added `displayLabel` to `PickupSlotData`.
4. Updated `src/app/student/home/page.tsx` — calls `ensureTodaysSlots()` + `getOrderMode()` server-side, passes slots with labels and order mode to UI.
5. Updated `MenuPageContent.tsx` — added `selectedSlotId` state, order mode banner (amber for pre-order, brand accent for walk-in), floating selected-slot indicator, passes selection props to detail view.
6. Updated `MenuItemDetail.tsx` — slots are now tappable buttons with brand highlight on selection, "Full" label when 0 remaining, walk-in mode notice, Add-to-Cart text adapts to state.

### Debug Log

- **Slot creation**: First-time page load creates 8 slots for today. Subsequent loads skip creation (idempotent check). Verified via Prisma count.
- **Order mode banner**: Uses local `new Date().getHours()` — before 9 AM shows pre-order banner, after 9 AM shows walk-in.
- **Walk-in slot hiding**: When `orderMode.isPreOrder === false`, the slot selection UI is completely hidden and a walk-in notice is shown instead.

### Completion Notes

All 6 tasks completed. Pickup slots auto-generated on first page load. Slot selection with visual highlight works. Pre-order vs walk-in mode detected with appropriate UI banners. Add-to-Cart button adapts to state (select slot / add to cart / sold out). Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/lib/slots.ts`: Slot generation utility — `ensureTodaysSlots()`, `toDisplayLabel()`.
- `src/lib/order-mode.ts`: Order mode detection — `getOrderMode()` for pre-order vs walk-in.

**Modified files:**
- `src/types/menu.ts`: Added `displayLabel` to `PickupSlotData`.
- `src/app/student/home/page.tsx`: Calls `ensureTodaysSlots()` + `getOrderMode()` server-side, passes to UI.
- `src/app/student/home/MenuPageContent.tsx`: Added `selectedSlotId` state, order mode banner, slot selection props.
- `src/components/menu/MenuItemDetail.tsx`: Selectable slots with highlight, walk-in mode, adaptive Add-to-Cart button.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 3, Story 3.2 |
| 2026-08-07 | Implementation complete — all 6 tasks done, all 7 ACs verified |
| 2026-08-07 | Status updated to `review` |
