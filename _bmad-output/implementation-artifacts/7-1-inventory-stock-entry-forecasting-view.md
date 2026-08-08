---
status: review
story_id: 7-1-inventory-stock-entry-forecasting-view
baseline_commit: 287242f472494924e09e3d4267c0d6f8d3aabc81
---

# Story 7.1: Inventory Stock Entry & Forecasting View

## Story

As an Admin,
I want to log daily opening and closing stock for ingredients and view it against forecasted needs,
So that I know exactly what supplies are available and what is running low.

## Acceptance Criteria

**Given** I navigate to the Admin Inventory screen
**When** I view the current stock list
**Then** I see all ingredients with columns: Name, Unit, Opening Stock, Closing Stock, Today's Wastage, and Forecasted Need
**And** for each ingredient I can input or edit the physical opening stock and closing stock amounts
**And** the "Forecasted Need" column shows the calculated required quantity based on tomorrow's ML Demand Forecast multiplied by the ingredient's recipe ratios (quantityPerPortion × predictedQty, summed across all menu items using that ingredient)

**Given** no ML Demand Forecast exists yet for tomorrow (e.g., before the nightly 18:00 run)
**When** I view the Inventory screen
**Then** the "Forecasted Need" column displays "—" (dash) with a tooltip: "Forecast not yet generated. Runs daily at 6 PM."

**Given** I enter or update the opening and closing stock for an ingredient today
**When** I save the entry
**Then** the record is persisted to the `InventoryRecord` table keyed by (ingredientId, date)
**And** the wastage field is automatically calculated as: `openingStock - closingStock` (sold/consumed portion is not yet tracked at this granularity — see Story 7.5 for full wastage = openingStock - closingStock - sold)

**Given** I try to backdate a stock entry by more than 1 day
**When** I submit the form
**Then** I receive a validation error: "Stock entries cannot be backdated more than 1 day." (FR-26 constraint)

**Given** I am on the Inventory screen
**When** I view the 7-day history
**Then** I see a table of the last 7 days of stock entries per ingredient with opening stock, closing stock, and wastage values
**And** I can navigate between dates using a date picker or prev/next arrows

## Requirements

### Functional Requirements

- **FR-26:** Inventory Management — Admins record daily opening stock levels per ingredient and log end-of-day levels. View current stock vs. forecasted ingredient need for the next day. [ASSUMPTION: Ingredient-to-menu-item recipe ratios are manually configured by Admin via the Menu Management screen.]
  - **FR-26a:** Forecasted ingredient need = ML Demand Forecast × configured recipe ratios (quantityPerPortion on MenuItemIngredient).
  - **FR-26b:** Stock entries are date-stamped and cannot be backdated more than 1 day.

### Non-Functional Requirements

- **NFR-5:** All `/api/admin/inventory/*` routes enforce JWT authentication + ADMIN role. No client-side-only access control.
- **NFR-1:** Inventory screen initial load (LCP) ≤ 2.5 seconds on 4G mobile connection.
- **NFR-11:** Inventory screen is responsive — fully usable on 375px mobile without horizontal scroll. Table columns stack or use horizontal scroll for the table itself.
- **NFR-12:** All interactive elements meet WCAG 2.1 AA minimum contrast ratios and have visible focus states.

### Architecture Decisions

- **AD-1 (RSC-first):** Inventory page shell is a Server Component (auth guard, initial data fetch). The stock entry form is a Client Component (interactive inputs, save/submit).
- **AD-2 (Prisma ORM):** All database access through Prisma Client. No raw SQL. Inventory records use upsert (upsert on `(ingredientId, date)` unique constraint).
- **AD-5 (ML Internal):** Forecasted Need data comes from the `DemandForecast` table (populated in Story 7.3). No direct ML service calls from this story. If forecast data is unavailable, the column shows "—".
- **AD-11 (One writer per entity):** `InventoryRecords` — Admin Route Handlers only. No Student access.

## Database Changes

### Existing Models (No Schema Changes Required)

All required models already exist in the current Prisma schema from Story 1.2. No migrations needed for this story.

```prisma
// Already exists — no changes
model Ingredient {
  id          String   @id @default(uuid())
  name        String   @unique
  unit        String                                // "kg" | "liters"
  createdAt   DateTime @default(now())

  menuItems        MenuItemIngredient[]
  inventoryRecords InventoryRecord[]
  procurementAlerts ProcurementAlert[]
}

// Already exists — no changes
model InventoryRecord {
  id            String     @id @default(uuid())
  ingredientId  String
  ingredient    Ingredient @relation(fields: [ingredientId], references: [id])
  date          DateTime   @db.Date
  openingStock  Decimal    @db.Decimal(8, 3)
  closingStock  Decimal?   @db.Decimal(8, 3)
  wastage       Decimal?   @db.Decimal(8, 3)        // derived: openingStock - closingStock
  createdAt     DateTime   @default(now())

  @@unique([ingredientId, date])
}

// Already exists — used for Forecasted Need calculation
model DemandForecast {
  id              String   @id @default(uuid())
  date            DateTime @db.Date
  menuItemId      String
  menuItem        MenuItem @relation(fields: [menuItemId], references: [id])
  predictedQty    Int
  lowEstimate     Int
  highEstimate    Int
  confidenceScore Decimal  @db.Decimal(5, 2)
  modelVersion    String
  generatedAt     DateTime @default(now())

  @@unique([date, menuItemId])
}

// Already exists — links ingredients to menu items with quantity per portion
model MenuItemIngredient {
  menuItemId           String
  ingredientId         String
  menuItem             MenuItem   @relation(fields: [menuItemId], references: [id])
  ingredient           Ingredient @relation(fields: [ingredientId], references: [id])
  quantityPerPortion   Decimal    @db.Decimal(8, 4)   // kg or liters per 1 portion

  @@id([menuItemId, ingredientId])
}
```

### Forecasted Need Calculation

The "Forecasted Need" for each ingredient is computed server-side as:

```
FOR each ingredient:
  tomorrowForecastedNeed = 0
  FOR each MenuItemIngredient linking this ingredient:
    demandForecast = DemandForecast WHERE date = tomorrow AND menuItemId = MenuItemIngredient.menuItemId
    IF demandForecast exists:
      tomorrowForecastedNeed += MenuItemIngredient.quantityPerPortion × demandForecast.predictedQty
```

If no DemandForecast records exist for tomorrow, the column displays "—".

### Wastage Calculation (Simplified for v1)

For this story, wastage is computed as: `openingStock - closingStock`. The full formula (`openingStock - closingStock - sold`) requires OrderItem-to-Ingredient mapping which is built in Story 7.5 (Wastage Heatmap). Add a comment in the code marking this as a placeholder for Story 7.5 enhancement.

## API Contracts

### GET /api/admin/inventory

Returns today's inventory records with forecasted need per ingredient.

**Query params:**
- `date`: `YYYY-MM-DD` (optional, defaults to today)

**Response:**
```json
{
  "date": "2026-08-08",
  "ingredients": [
    {
      "id": "uuid",
      "name": "Rice",
      "unit": "kg",
      "openingStock": 25.000,
      "closingStock": null,
      "wastage": null,
      "forecastedNeed": 18.500,
      "hasForecast": true
    },
    {
      "id": "uuid",
      "name": "Chicken",
      "unit": "kg",
      "openingStock": null,
      "closingStock": null,
      "wastage": null,
      "forecastedNeed": null,
      "hasForecast": false
    }
  ]
}
```

### POST /api/admin/inventory

Create or update an inventory record for a specific ingredient on a specific date. Uses upsert on the `(ingredientId, date)` unique constraint.

**Request body:**
```json
{
  "ingredientId": "uuid",
  "date": "2026-08-08",
  "openingStock": 25.000,
  "closingStock": 22.500
}
```

**Response:**
```json
{
  "record": {
    "id": "uuid",
    "ingredientId": "uuid",
    "date": "2026-08-08",
    "openingStock": 25.000,
    "closingStock": 22.500,
    "wastage": 2.500,
    "createdAt": "2026-08-08T14:00:00Z"
  }
}
```

**Validation:**
- `date` cannot be more than 1 day in the past (validation error: "Stock entries cannot be backdated more than 1 day.")
- `date` cannot be in the future (validation error: "Stock entries cannot be future-dated.")
- `openingStock` must be ≥ 0
- `closingStock` if provided must be ≥ 0 and ≤ openingStock (warning, not hard error)

### GET /api/admin/inventory/history

Returns 7-day history of inventory records for all ingredients.

**Query params:**
- `from`: `YYYY-MM-DD` (optional, defaults to 7 days ago)
- `to`: `YYYY-MM-DD` (optional, defaults to today)

**Response:**
```json
{
  "history": [
    {
      "date": "2026-08-08",
      "ingredients": [
        { "id": "uuid", "name": "Rice", "unit": "kg", "openingStock": 25.0, "closingStock": 22.5, "wastage": 2.5 }
      ]
    }
  ]
}
```

## Tasks / Subtasks

- [x] Task 1: Create Inventory API routes (AC: all AC items)
  - [x] `GET /api/admin/inventory/route.ts` — list today's inventory with forecasted need per ingredient
  - [x] `POST /api/admin/inventory/route.ts` — upsert stock entry (opening + closing) for ingredient+date
  - [x] `GET /api/admin/inventory/history/route.ts` — 7-day inventory history
  - [x] All routes use `requireApiRole("ADMIN")`
  - [x] Forecasted need calculation: aggregate `DemandForecast.predictedQty × MenuItemIngredient.quantityPerPortion` per ingredient
  - [x] Backdate validation: reject dates older than 1 day from today
  - [x] Future-date validation: reject dates in the future

- [x] Task 2: Create Admin Inventory page (AC: inventory list with all columns)
  - [x] `src/app/admin/inventory/page.tsx` — Server Component: `requireAuth` guard, ADMIN role check, initial data fetch
  - [x] `src/app/admin/inventory/InventoryClient.tsx` — Client Component: ingredient table with inline stock editing
  - [x] Display columns: Ingredient Name (with Unit), Opening Stock (editable input), Closing Stock (editable input), Wastage (computed), Forecasted Need
  - [x] Empty state: "No inventory records for today. Enter opening stock to get started."

- [x] Task 3: Create InventoryTableRow component (AC: inline edit + save)
  - [x] `src/components/admin/InventoryTableRow.tsx` — Client Component: single ingredient row
  - [x] Inline editable fields for openingStock and closingStock
  - [x] Save button triggers POST /api/admin/inventory with debounce or explicit save
  - [x] Wastage auto-calculated on blur/change: `openingStock - closingStock`
  - [x] Forecasted Need cell: shows value if forecast exists, "—" with tooltip if not
  - [x] Visual feedback: green flash on save success, red border on validation error

- [x] Task 4: Create 7-Day History view (AC: history table)
  - [x] Add history section below the today's stock table (or separate tab)
  - [x] Fetch `GET /api/admin/inventory/history` on mount
  - [x] Table: Date as row, ingredients as columns (or transpose: ingredients as rows, dates as columns)
  - [x] Date picker or prev/next navigation for date ranges
  - [x] Loading skeleton while fetching history

- [x] Task 5: Add Inventory link to Admin navigation
  - [x] Add "Inventory" button to `src/app/admin/dashboard/AdminDashboardClient.tsx` header
  - [x] Link to `/admin/inventory`
  - [x] Use consistent button styling from existing "Menu" and "Orders" buttons

- [x] Task 6: End-to-end verification
  - [x] All API routes return 401/403 for unauthenticated/non-admin requests
  - [x] Stock entry persistence: save → reload → data survives
  - [x] Backdate validation: entering a date > 1 day ago returns error
  - [x] Forecasted Need shows "—" when no DemandForecast records exist
  - [x] 7-day history loads and displays correctly
  - [x] Mobile responsive: table is usable at 375px width
  - [x] Lint check: zero new errors

## File List

| File | Action |
|------|--------|
| `src/app/api/admin/inventory/route.ts` | NEW — GET today's inventory + forecasted need, POST upsert stock entry |
| `src/app/api/admin/inventory/history/route.ts` | NEW — GET 7-day inventory history |
| `src/app/admin/inventory/page.tsx` | NEW — RSC page with auth guard + initial data fetch |
| `src/app/admin/inventory/InventoryClient.tsx` | NEW — Client Component: today's stock table with inline editing |
| `src/components/admin/InventoryTableRow.tsx` | NEW — Single ingredient row with editable inputs |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Add "Inventory" navigation button |
| `src/lib/inventory.ts` | NEW — Server-side forecasted need calculation helper |

## Dev Notes

### Architecture Context

This is the first story in Epic 7 (ML Demand Forecasting, Cook Plan & Waste Intelligence). It establishes the foundation for inventory tracking that all subsequent Epic 7 stories depend on:

- **Story 7.1 (this one):** Stock entry UI + forecasted need view
- **Story 7.2:** Procurement alerts + PDF POs (reads stock + forecasted need)
- **Story 7.3:** ML forecast engine cron (writes DemandForecast records)
- **Story 7.4:** Cook Plan generation (reads DemandForecast + Inventory)
- **Story 7.5:** Wastage heatmap (reads InventoryRecord history)
- **Story 7.6:** ML model retraining pipeline

### Key Design Decisions

1. **No schema changes.** All models (Ingredient, InventoryRecord, DemandForecast, MenuItemIngredient) already exist from Story 1.2. This story is purely about UI + API on existing tables.

2. **Forecasted Need = NULL-safe.** Since DemandForecast records won't exist until Story 7.3's cron runs, the UI must handle the "no forecast" state gracefully. The API should return `forecastedNeed: null, hasForecast: false` when no DemandForecast records exist for tomorrow.

3. **Upsert pattern.** Use Prisma `upsert` on the `(ingredientId, date)` unique composite key. This handles both create-new and update-existing in one database call. The upsert is idempotent — safe for repeat calls.

4. **Wastage simplified for now.** Current wastage = `openingStock - closingStock`. The full formula `openingStock - closingStock - soldPortions` will be added in Story 7.5 when the ingredient-to-order mapping is built. Mark this clearly in code comments.

5. **Ingredient units come from the Ingredient model.** Each ingredient has a `unit` field ("kg" or "liters"). Display this next to the ingredient name.

### Forecasted Need Calculation (Server-Side)

```typescript
// lib/inventory.ts — helper function

export async function calculateForecastedNeed(ingredientId: string, date: Date) {
  // Get all menu items that use this ingredient
  const links = await prisma.menuItemIngredient.findMany({
    where: { ingredientId },
    include: {
      menuItem: {
        include: {
          demandForecasts: {
            where: { date: tomorrow },
          },
        },
      },
    },
  });

  // Sum: quantityPerPortion × predictedQty
  let total = 0;
  let hasForecast = false;
  for (const link of links) {
    const forecast = link.menuItem.demandForecasts[0];
    if (forecast) {
      hasForecast = true;
      total += Number(link.quantityPerPortion) * forecast.predictedQty;
    }
  }

  return hasForecast ? total : null;
}
```

### Admin Navigation Pattern

The existing Admin Dashboard header has buttons for "Dashboard", "Orders", and "Menu". Follow the same pattern:

```tsx
// Existing pattern in AdminDashboardClient.tsx
<Link href="/admin/inventory">
  <Button variant="ghost">Inventory</Button>
</Link>
```

### Styling Standards

- **Glassmorphism cards** for the inventory table container (matching existing admin style)
- **shadcn/ui Table** component for the stock list and history
- **shadcn/ui Input** with type="number" for stock entry fields (step="0.001" for 3 decimal precision)
- **Framer Motion** `AnimatePresence` for save success animation
- **Dark mode aesthetic** with vibrant accent colours (matching existing Admin theme)
- **Responsive:** Table uses `overflow-x-auto` on mobile; rows are at least 44px tall for touch targets
- Loading state: **Skeleton** (`src/components/ui/skeleton.tsx`) while fetching data

### Validation Rules

| Field | Rule | Error Message |
|---|---|---|
| date | Cannot be > 1 day in the past | "Stock entries cannot be backdated more than 1 day." |
| date | Cannot be in the future | "Stock entries cannot be future-dated." |
| openingStock | Must be ≥ 0 | "Opening stock cannot be negative." |
| closingStock | Must be ≥ 0 | "Closing stock cannot be negative." |
| closingStock | Warning if > openingStock | "Closing stock exceeds opening stock. Please verify." (soft warning, still allows save) |

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.1]
- [Source: _bmad-output/planning-artifacts/prds/prd-canteen_system-2026-08-03/prd.md — §4.7, FR-26]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/ARCHITECTURE-SPINE.md — AD-1, AD-2, AD-5, AD-11]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/SOLUTION-DESIGN.md — §4.2 Inventory models, §3 Technology Stack]
- [Source: prisma/schema.prisma — Ingredient, InventoryRecord, DemandForecast, MenuItemIngredient models]
- [Source: src/app/api/admin/ingredients/route.ts — existing ingredient API pattern]
- [Source: src/app/admin/menu/page.tsx — existing admin page pattern (RSC + Client split)]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (DeepSeek V4 Pro)

### Implementation Plan

1. API layer first: inventory CRUD with forecasted need aggregation, history endpoint
2. Server-side helper: `lib/inventory.ts` for forecasted need calculation, date validation, stock amount validation
3. UI: RSC page + Client component with glassmorphism styling
4. Component: InventoryTableRow for inline editing with save feedback
5. Navigation: "Inventory" button on admin dashboard

### Completion Notes

- All 6 tasks completed with zero lint errors across 7 files (6 new, 1 modified)
- No Prisma schema changes required — all models existed from Story 1.2
- API routes: GET /api/admin/inventory (today's stock + forecasted need per ingredient), POST /api/admin/inventory (upsert via (ingredientId, date) composite key), GET /api/admin/inventory/history (7-day range query)
- All routes secured with requireApiRole("ADMIN")
- Forecasted need calculated server-side as Σ(quantityPerPortion × predictedQty) across MenuItemIngredient links to DemandForecast for tomorrow
- Graceful handling: forecastedNeed returns null with "—" display when no DemandForecast exists (before Story 7.3 cron runs)
- Date validation: reject dates > 1 day in past (FR-26b) and future dates
- Amount validation: non-negative opening/closing stock
- Wastage computed as openingStock - closingStock; full formula (including soldPortions) deferred to Story 7.5
- Admin dashboard: "Inventory" nav button added alongside existing Orders/Menu/Refresh buttons
- Mobile responsive: table uses overflow-x-auto for horizontal scroll on small screens
- Dark mode glassmorphism aesthetic consistent with existing admin pages
- Toggle between Today view (with date navigation) and 7-Day History view (with date range picker)
- Inline save per row with success animation (green check) and error display (red text)
- Empty states: "No ingredients configured", "No inventory records for date", "No records for date range"

### File List

| File | Action |
|------|--------|
| `src/lib/inventory.ts` | NEW — forecasted need calculation, date/amount validation, buildInventoryRows |
| `src/app/api/admin/inventory/route.ts` | NEW — GET today's inventory + forecasted need, POST upsert stock entry |
| `src/app/api/admin/inventory/history/route.ts` | NEW — GET 7-day inventory history |
| `src/app/admin/inventory/page.tsx` | NEW — RSC page with auth guard + initial data fetch |
| `src/app/admin/inventory/InventoryClient.tsx` | NEW — Client Component: today's table + 7-day history with toggle |
| `src/components/admin/InventoryTableRow.tsx` | NEW — Single ingredient row with inline editing |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Added Inventory nav button + Boxes icon import |

## Change Log

- 2026-08-08: Story 7.1 implementation complete
  - 3 new API routes (inventory CRUD + history)
  - Admin Inventory page at /admin/inventory with today view + 7-day history toggle
  - Inline stock editing with server-side forecasted need per ingredient
  - Date validation (backdate limit + future-date rejection)
  - Admin dashboard navigation link to Inventory
  - All routes secured with requireApiRole("ADMIN")
  - Zero lint errors in new files
