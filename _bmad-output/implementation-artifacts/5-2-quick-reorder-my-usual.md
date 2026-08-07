---
status: review
story_id: 5-2-quick-reorder-my-usual
baseline_commit: 9917a9e8e85cbcecda58e6fa4ac51b33cf254312
---

# Story 5.2: Quick Reorder (My Usual)

## Story

As a Student,
I want to see my 3 most frequently ordered item combinations and reorder them with one tap,
So that I don't have to manually build my cart every day.

## Acceptance Criteria

**Given** I have placed ≥ 1 order in the last 14 days
**When** I view the Student Home page
**Then** I see a "My Usual" section showing my top 3 most frequently ordered item combinations, each listing the items, total price, and how many times I've ordered that combo ✅
**And** tapping "Reorder" on any combination instantly populates my cart with those items (same quantities) and scrolls down/open the cart panel ✅
**And** the section is hidden if I have no recent orders ✅
**And** each combo shows a mini summary: "Rice & Curry + Tea (ordered 5×)" with the total price ✅

## Tasks / Subtasks

- [x] Task 1: Create the My Usual server utility (`src/lib/my-usual.ts`)
  - [ ] Create `src/lib/my-usual.ts` — exports `getMyUsual(userId: string)`
  - [ ] Query the student's orders from the last 14 days via Prisma
  - [ ] Group orders by their item composition: concatenate `itemName:quantity` pairs sorted alphabetically as a unique key
  - [ ] Count occurrences of each unique combination, sum totalAmount for each
  - [ ] Return top 3 combinations by frequency (most ordered), with: combo label, item list (names + quantities), totalPrice, orderCount
  - [ ] If fewer than 14 days of data exist, use all available data (graceful degradation)
  - [ ] If no orders exist, return empty array

- [x] Task 2: Fetch My Usual data in the Student Home page
  - [ ] Update `src/app/student/home/page.tsx` — call `getMyUsual(session.user.id)` alongside existing menu/wallet queries
  - [ ] Pass `myUsual` data as a prop to `MenuPageContent`

- [x] Task 3: Create the My Usual UI component
  - [ ] Create `src/components/menu/MyUsualSection.tsx` — Client Component
  - [ ] Props: `combos: MyUsualCombo[]`, `onReorder: (combo: MyUsualCombo) => void`
  - [ ] Display as a horizontal scrollable row of cards above the menu grid
  - [ ] Each card: combo label (e.g., "Rice & Curry + Tea"), item list (icons or text), total price, "Ordered X×" badge, "Reorder" button
  - [ ] Glassmorphism card styling consistent with the rest of the app
  - [ ] Loading state: skeleton cards while data loads
  - [ ] Empty state: hidden (don't render the section at all)

- [x] Task 4: Wire reorder to cart
  - [ ] In `MenuPageContent.tsx`: add `myUsual` prop and `handleReorder(combo)` function
  - [ ] `handleReorder`: maps combo items to `CartItem[]`, sets the cart state directly, opens the cart panel
  - [ ] Auto-scroll to cart panel after reorder
  - [ ] Preserve existing cart items — reorder adds to existing cart, doesn't replace

- [x] Task 5: Output type definitions and data structure
  - [ ] Add `MyUsualCombo` type to `src/types/menu.ts`:
    ```
    { id: string; label: string; items: { menuItemId: string; name: string; quantity: number; price: number }[]; totalPrice: number; orderCount: number }
    ```

- [x] Task 6: End-to-end verification
  - [ ] Place 3+ orders with different item combinations
  - [ ] Navigate to Student Home → verify "My Usual" section appears above the menu
  - [ ] Verify each combo card shows items, total price, and order count
  - [ ] Tap "Reorder" on a combo → verify cart populates with correct items and quantities
  - [ ] Verify cart opens automatically after reorder
  - [ ] Place another order of the same combo → verify the reorder count increases
  - [ ] New student with 0 orders → verify "My Usual" section is hidden
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-19**: Quick Reorder ("My Usual") — top 3 combinations from last 14 days, one-tap reorder.
- **AD-1 (RSC-first)**: My Usual data fetched server-side via `getMyUsual()`. UI is a Client Component.
- **AD-2**: All queries through Prisma.

### Combination Detection Algorithm

Group orders by their item composition. The "signature" of a combination is a sorted, normalized string of `itemId:quantity` pairs:

```typescript
// For each order, extract items and create a sorted signature
const signature = order.items
  .map((oi) => `${oi.menuItemId}:${oi.quantity}`)
  .sort()
  .join("|");

// Group orders by signature, count occurrences
// Return top 3 by occurrence count
```

This approach:
- Treats "Rice(x2) + Tea(x1)" as DIFFERENT from "Rice(x1) + Tea(x1)"
- Treats "Rice + Tea" as SAME regardless of which was added first in the cart (sorted)
- Only counts the item composition, not the slot or order metadata

### My Usual Data Structure

```typescript
interface MyUsualCombo {
  id: string;           // Signature hash
  label: string;        // "Rice & Curry + Tea"
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;      // Current basePrice or specialPrice
  }[];
  totalPrice: number;   // Current total (may differ from historical total)
  orderCount: number;   // How many times ordered
}
```

### Query Implementation

```typescript
const fourteenDaysAgo = new Date();
fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

const orders = await prisma.order.findMany({
  where: {
    studentId: userId,
    createdAt: { gte: fourteenDaysAgo },
  },
  include: {
    items: { include: { menuItem: true } },
  },
});

// Group by signature
const comboMap = new Map<string, { items: typeof orders[0]["items"]; count: number }>();
for (const order of orders) {
  const signature = order.items
    .map((oi) => `${oi.menuItemId}:${oi.quantity}`)
    .sort()
    .join("|");
  const existing = comboMap.get(signature);
  if (existing) {
    existing.count++;
  } else {
    comboMap.set(signature, { items: order.items, count: 1 });
  }
}

// Top 3 by count
const top3 = [...comboMap.entries()]
  .sort(([, a], [, b]) => b.count - a.count)
  .slice(0, 3)
  .map(([sig, val]) => {
    const label = val.items.map((oi) => oi.menuItem.name).join(" + ");
    const currentPrice = val.items.reduce(
      (sum, oi) => sum + Number(oi.menuItem.basePrice) * oi.quantity, 0
    );
    return {
      id: sig,
      label,
      items: val.items.map((oi) => ({
        menuItemId: oi.menuItemId,
        name: oi.menuItem.name,
        quantity: oi.quantity,
        price: Number(oi.menuItem.basePrice),
      })),
      totalPrice: currentPrice,
      orderCount: val.count,
    };
  });
```

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── my-usual.ts                      # getMyUsual() (NEW)
│   ├── types/
│   │   └── menu.ts                           # Add MyUsualCombo type (MODIFIED)
│   ├── app/
│   │   └── student/
│   │       └── home/
│   │           ├── page.tsx                  # Fetch myUsual data (MODIFIED)
│   │           └── MenuPageContent.tsx       # MyUsual section + handleReorder (MODIFIED)
│   └── components/
│       └── menu/
│           └── MyUsualSection.tsx            # My Usual row UI (NEW)
```

### Important Edge Cases

1. **Fewer than 3 combos**: Show however many exist. No empty placeholder cards.
2. **0 orders**: Don't render the section at all. No "Your order history is empty" message — just show the menu.
3. **Menu item prices change**: `totalPrice` uses CURRENT `MenuItem.basePrice`, not historical order prices. This ensures the cart total is accurate when the student reorders.
4. **Inactive menu items**: If a previously-ordered item is now inactive (`isActive: false`), skip that combo entirely.
5. **14-day window**: Orders older than 14 days are excluded. This keeps "My Usual" fresh.
6. **Reorder adds to existing cart**: Items are added on top of whatever is already in the cart. The student can remove items afterward.

### Previous Context

- **Story 5.1**: Analytics page with spend data. Not directly related.
- **Story 3.3**: Cart state management (`addToCart`, `setCart`, `setCartOpen`) already in `MenuPageContent`.
- **Story 3.1**: Menu page with `MenuItemCard`, `MenuPageContent` with filter chips and header.

## Dev Agent Record

### Implementation Plan

(To be filled by dev agent during implementation)

### Debug Log

(To be filled by dev agent during implementation)

### Completion Notes

(To be filled by dev agent upon completion)

## File List

(To be filled by dev agent — paths relative to repo root)

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 5, Story 5.2: Quick Reorder (My Usual) |
