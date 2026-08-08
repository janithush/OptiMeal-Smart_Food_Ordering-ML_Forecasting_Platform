---
status: review
story_id: 7-5-wastage-heatmap-demand-insights
epic: 7
story_num: 5
created: 2026-08-09
---

# Story 7.5: Wastage Heatmap & Demand Segment Insights

## Story

As an Admin,
I want to view a 7-day rolling ingredient wastage heatmap and demand breakdowns by department and dietary preference,
So that I can analyze trends and continuously optimize canteen operations.

## Acceptance Criteria

**Given** I navigate to the Admin Analytics screen
**When** the data loads
**Then** I see a color-coded (Red/Amber/Green) 7-day rolling Wastage Heatmap for each ingredient
**And** I see breakdown charts showing demand by Department (ICT/ET/BST) and Dietary Preference — strictly aggregated and anonymised (NFR-8)
**And** I can tap any cell in the heatmap to view the raw opening stock, closing stock, and calculated waste figures for that day and ingredient

**Given** inventory records exist for the last 7 days
**When** the Wastage Heatmap renders
**Then** each cell shows the waste rate as a percentage: `(wastage / (openingStock + receivedStock)) × 100`
**And** cells are color-coded: **Red** (>15% waste rate), **Amber** (8–15%), **Green** (<8%)
**And** cells with no data (missing records) display "—" in muted text
**And** ingredients with `isActive = false` are excluded from the heatmap

**Given** I tap on a cell in the heatmap
**When** the detail overlay opens
**Then** I see the raw figures for that day and ingredient: Opening Stock, Received Stock, Consumed Stock, Closing Stock, and Calculated Wastage (with unit)

**Given** I view the Demand Segments section
**When** the charts load
**Then** I see a bar chart (Recharts) showing order count by Department (ICT, ET, BST) aggregated over the last 30 days
**And** I see a pie/donut chart (Recharts) showing order count by Dietary Preference (Vegan, Vegetarian, Non-Veg) aggregated over the last 30 days
**And** no individual Student data is exposed — all counts are aggregated from the `Order` + `OrderItem` + `User` tables

**Given** the Admin Dashboard navigation
**When** I look at the header
**Then** I see an "Analytics" button that links to `/admin/analytics`

## Requirements

### Functional Requirements

- **FR-31a:** Wastage Heatmap — 7-day rolling waste rate display per ingredient. Waste rate = `(wastage / (openingStock + receivedStock)) × 100`. Color-coded: Red (>15%), Amber (8–15%), Green (<8%). Tap cell for raw figures.
- **FR-31b:** Raw Data Overlay — Tapping a heatmap cell shows a detail card with: Opening Stock, Received Stock, Consumed Stock, Closing Stock, and Wastage for that specific day and ingredient. All values displayed with their units (kg/liters/nuts).
- **FR-32a:** Demand by Department — Bar chart showing total order quantity per Department (ICT/ET/BST) over the last 30 days. Uses aggregated data from `Order` JOIN `User`.
- **FR-32b:** Demand by Dietary Preference — Pie/donut chart showing total order quantity per Dietary Preference (Vegan/Vegetarian/Non-Veg) over the last 30 days. Uses aggregated data from `Order` JOIN `User`.
- **NFR-8 Compliance:** All charts use `groupBy` + `_count` / `_sum` aggregations. No individual Student IDs, names, or order details exposed. Raw SQL uses `$queryRawUnsafe` only for aggregation queries — never returns individual rows.

### Non-Functional Requirements

- **NFR-5:** All `/api/admin/analytics/*` routes enforce JWT authentication + ADMIN role.
- **NFR-8:** Student personal data never exposed through Admin analytics. Segment analytics use aggregated, anonymised data only — `groupBy` with `_count`/`_sum`, never individual row retrieval.
- **NFR-11:** Analytics screen responsive — usable on 375px mobile. Charts stack vertically on mobile, side-by-side on desktop.
- **NFR-12:** All interactive elements meet WCAG 2.1 AA minimum contrast ratios. Red/Amber/Green heatmap colors must pass contrast checks against the dark background.

### Architecture Decisions

- **AD-1 (RSC-first):** Analytics page shell is a Server Component (auth guard, initial data fetch). The heatmap and chart components are Client Components (Recharts requires browser).
- **AD-2 (Prisma ORM):** All data aggregation through Prisma `groupBy`, `aggregate`, and `$queryRawUnsafe` for complex aggregations. No raw SQL scattered in route handlers — all queries centralized in `src/lib/analytics.ts`.
- **AD-11 (One Writer):** Analytics are read-only. No mutation routes. No Admin writes to analytics data.

## Database Changes

### No Schema Changes Required

All required models already exist. This story is purely about read-only aggregation queries on existing tables:

```prisma
// Already exists — used for wastage calculation
model InventoryRecord {
  openingStock   Decimal    @db.Decimal(8, 3)
  receivedStock  Decimal?   @db.Decimal(8, 3)
  consumedStock  Decimal?   @db.Decimal(8, 3)
  closingStock   Decimal?   @db.Decimal(8, 3)
  wastage        Decimal?   @db.Decimal(8, 3)
  // ...
}

// Already exists — used for demand segment filtering
model User {
  department        Department?
  dietaryPreference DietaryPreference?
  // ...
}

// Already exists — used for demand aggregation
model Order {
  type       OrderType
  studentId  String
  student    User      @relation(fields: [studentId], references: [id])
  orderItems OrderItem[]
  // ...
}

model OrderItem {
  orderId    String
  menuItemId String
  quantity   Int
  // ...
}
```

### Wastage Rate Formula

```
Wastage Rate (%) = (wastage / (openingStock + COALESCE(receivedStock, 0))) × 100

Where:
  - wastage = openingStock + receivedStock − consumedStock − closingStock
  - Division by zero is handled → shows "—"
  - The denominator uses available stock (opening + received), not just opening
```

### Heatmap Color Coding

| Range | Color | Hex (Tailwind) | Meaning |
|-------|-------|----------------|---------|
| > 15% | **Red** | `bg-red-500/30 text-red-400` | High waste — investigate immediately |
| 8–15% | **Amber** | `bg-amber-500/30 text-amber-400` | Moderate waste — monitor |
| < 8% | **Green** | `bg-emerald-500/30 text-emerald-400` | Normal waste — acceptable |
| No data | — | `text-[var(--text-disabled)]` | Missing inventory record |

## API Contracts

### GET /api/admin/analytics/wastage

Returns 7-day rolling wastage data per active ingredient.

**Auth:** `requireApiRole("ADMIN")`

**Response:**
```json
{
  "dateRange": { "from": "2026-08-03", "to": "2026-08-09" },
  "ingredients": [
    {
      "id": "uuid",
      "name": "Chicken",
      "unit": "kg",
      "days": [
        {
          "date": "2026-08-03",
          "openingStock": 25.0,
          "receivedStock": 5.0,
          "consumedStock": 7.5,
          "closingStock": 22.0,
          "wastage": 0.5,
          "wasteRate": 1.67
        },
        {
          "date": "2026-08-04",
          "openingStock": null,
          "receivedStock": null,
          "consumedStock": null,
          "closingStock": null,
          "wastage": null,
          "wasteRate": null
        }
      ]
    }
  ]
}
```

### GET /api/admin/analytics/demand-segments

Returns aggregated demand by Department and Dietary Preference over 30 days.

**Auth:** `requireApiRole("ADMIN")`

**Response:**
```json
{
  "period": { "from": "2026-07-10", "to": "2026-08-09" },
  "byDepartment": [
    { "department": "ICT", "orderCount": 245, "quantitySold": 412 },
    { "department": "ET", "orderCount": 198, "quantitySold": 335 },
    { "department": "BST", "orderCount": 167, "quantitySold": 289 }
  ],
  "byDietaryPreference": [
    { "preference": "NON_VEGETARIAN", "orderCount": 380, "quantitySold": 640 },
    { "preference": "VEGETARIAN", "orderCount": 195, "quantitySold": 330 },
    { "preference": "VEGAN", "orderCount": 35, "quantitySold": 66 }
  ]
}
```

## Tasks / Subtasks

- [x] Task 1: Create Analytics API routes
  - [x] `src/app/api/admin/analytics/wastage/route.ts` — GET 7-day wastage per ingredient
  - [x] `src/app/api/admin/analytics/demand-segments/route.ts` — GET demand by dept + dietary
  - [x] All routes secured with `requireApiRole("ADMIN")`

- [x] Task 2: Create Analytics data library
  - [x] `src/lib/analytics.ts` — `getWastageData()`, `getDemandSegments()`
  - [x] `getWastageData()`: queries `InventoryRecord` for last 7 days per active ingredient, calculates waste rate per day
  - [x] `getDemandSegments()`: aggregates `Order` + `OrderItem` + `User` by `User.department` and `User.dietaryPreference` over 30 days
  - [x] All aggregations use `groupBy` or `$queryRawUnsafe` — no individual row data returned (NFR-8)

- [x] Task 3: Create Wastage Heatmap component
  - [x] `src/components/admin/WastageHeatmap.tsx` — Client Component
  - [x] Table layout: Ingredients as rows, 7 dates as columns
  - [x] Each cell shows waste rate % with color-coded background (Red/Amber/Green)
  - [x] Click a cell → opens detail overlay showing raw figures
  - [x] Responsive: horizontal scroll for the table on mobile
  - [x] Loading skeleton while data fetches
  - [x] Empty state: "No inventory records for this period"

- [x] Task 4: Create Demand Segments chart component
  - [x] `src/components/admin/DemandSegments.tsx` — Client Component
  - [x] Bar chart (Recharts `BarChart`) for Department breakdown — ICT/ET/BST
  - [x] Pie/donut chart (Recharts `PieChart`) for Dietary Preference breakdown
  - [x] Both charts use the existing dark theme + glassmorphism card styling
  - [x] Responsive: charts stack vertically on mobile, side-by-side on desktop
  - [x] Loading skeleton while data fetches
  - [x] Empty state: "No order data available for this period"

- [x] Task 5: Create Admin Analytics page
  - [x] `src/app/admin/analytics/page.tsx` — RSC page with auth guard + initial data fetch
  - [x] Layout: Wastage Heatmap section (top) + Demand Segments section (bottom)
  - [x] Glassmorphism card containers matching existing Admin theme
  - [x] Responsive: sections stack vertically on mobile

- [x] Task 6: Add Analytics nav button to Admin Dashboard
  - [x] Update `AdminDashboardClient.tsx` — Add "Analytics" nav button linking to `/admin/analytics`
  - [x] Use consistent button styling from existing nav buttons
  - [x] Import `BarChart3` icon from lucide-react

- [x] Task 7: End-to-end verification
  - [x] Analytics page loads at `/admin/analytics` with wastage + demand data
  - [x] Heatmap shows Red/Amber/Green cells correctly based on waste rate
  - [x] Tapping a cell opens the raw data overlay
  - [x] Department bar chart renders correctly
  - [x] Dietary preference pie chart renders correctly
  - [x] No student data exposed in API responses (verify only aggregated numbers)
  - [x] Responsive on 375px mobile
  - [x] All API routes return 401/403 for unauthenticated/non-admin requests
  - [x] Run `npm run lint` — zero new errors

## File List

| File | Action |
|------|--------|
| `src/lib/analytics.ts` | NEW — Wastage + demand segment aggregation queries |
| `src/app/api/admin/analytics/wastage/route.ts` | NEW — GET 7-day wastage data |
| `src/app/api/admin/analytics/demand-segments/route.ts` | NEW — GET demand by dept + dietary |
| `src/components/admin/WastageHeatmap.tsx` | NEW — Heatmap table with color-coded cells |
| `src/components/admin/DemandSegments.tsx` | NEW — Bar chart + pie chart |
| `src/app/admin/analytics/page.tsx` | NEW — RSC page shell |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Add Analytics nav button |

## Dev Notes

### Architecture Context

This is the fifth story in Epic 7. It depends on all four previous stories for data:

- **Depends on Story 7.1**: `InventoryRecord` table with corrected wastage formula (`openingStock + receivedStock − consumedStock − closingStock`) — used for wastage heatmap
- **Depends on Story 7.2**: Two-tier procurement alert system — not directly consumed but part of the same admin analytics surface
- **Depends on Story 7.3**: `DemandForecast` + `CookPlanItem` tables — provides the forecast / confirmed quantities context for waste analysis
- **Depends on Story 7.4**: CONFIRMED `CookPlanItem.finalQty` — can be used to compare planned vs actual consumption
- **Depends on Epics 2-5**: `Order`, `OrderItem`, `User` tables with department and dietary preference data

**This is a read-only analytics story.** No schema changes. No write operations. Pure data aggregation and visualization.

### Key Design Decisions

1. **No schema changes.** All data comes from existing tables: `InventoryRecord`, `Order`, `OrderItem`, `User`. This story is purely aggregation + visualization.

2. **Recharts for all charts.** Already installed and proven in the project (`HourlySalesChart`, `ItemSalesList`). Bar chart for department breakdown, pie/donut chart for dietary preference. Consistent dark theme styling.

3. **Wastage rate uses corrected formula.** Waste rate = `wastage / (openingStock + receivedStock) × 100`. The denominator includes received stock to give a more accurate picture. Edge case: when `openingStock + receivedStock = 0` (no stock at all), waste rate is `null` → displays "—".

4. **Heatmap is a table, not a chart library.** A simple HTML table with Tailwind color classes is more readable and performant than a charting library heatmap. Ingredients as rows, 7 dates as columns. Each cell shows the waste rate percentage.

5. **Demand segments use aggregation queries.** Prisma `groupBy` queries on `Order` + `OrderItem` + `User` ensure only aggregated counts are returned. No individual student data exposed. Complies with NFR-8.

6. **Raw data overlay on cell tap.** Clicking a heatmap cell opens a detail card with the full inventory record for that day + ingredient. Uses Framer Motion `AnimatePresence` for smooth enter/exit.

7. **Analytics page follows existing Admin patterns.** RSC shell + Client Component, glassmorphism cards, dark theme, `requireApiRole("ADMIN")` on all routes. The page is at `/admin/analytics` for parity with `/admin/analytics` in the PRD's UX-DR6 navigation spec.

### Wastage Data Aggregation Logic

```typescript
// src/lib/analytics.ts — pseudocode

export async function getWastageData(): Promise<WastageResponse> {
  const today = getTodayDate();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6); // 7 days inclusive

  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const records = await prisma.inventoryRecord.findMany({
    where: {
      date: { gte: sevenDaysAgo, lte: today },
      ingredientId: { in: ingredients.map(i => i.id) },
    },
    orderBy: { date: "asc" },
  });

  // Build map: ingredientId → date → record
  const recordMap = new Map<string, Map<string, typeof records[0]>>();
  for (const r of records) {
    const dateKey = r.date.toISOString().split("T")[0];
    if (!recordMap.has(r.ingredientId)) recordMap.set(r.ingredientId, new Map());
    recordMap.get(r.ingredientId)!.set(dateKey, r);
  }

  // Build response with 7 days per ingredient
  const days: string[] = [];
  const d = new Date(sevenDaysAgo);
  while (d <= today) {
    days.push(d.toISOString().split("T")[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return {
    dateRange: { from: days[0], to: days[days.length - 1] },
    ingredients: ingredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      days: days.map(dateKey => {
        const r = recordMap.get(ing.id)?.get(dateKey);
        if (!r) return { date: dateKey, openingStock: null, receivedStock: null,
          consumedStock: null, closingStock: null, wastage: null, wasteRate: null };

        const opening = Number(r.openingStock);
        const received = Number(r.receivedStock ?? 0);
        const consumed = Number(r.consumedStock ?? 0);
        const closing = Number(r.closingStock ?? 0);
        const waste = Number(r.wastage ?? (opening + received - consumed - closing));
        const available = opening + received;
        const wasteRate = available > 0 ? (waste / available) * 100 : null;

        return { date: dateKey, openingStock: opening, receivedStock: received,
          consumedStock: consumed, closingStock: closing, wastage: waste,
          wasteRate: wasteRate !== null ? Math.round(wasteRate * 100) / 100 : null };
      }),
    })),
  };
}
```

### Demand Segment Aggregation Logic

```typescript
// src/lib/analytics.ts — pseudocode

export async function getDemandSegments(): Promise<DemandSegmentsResponse> {
  const today = getTodayDate();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  // By Department (NFR-8: aggregated, no individual data)
  const byDept = await prisma.order.groupBy({
    by: ["studentId"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: true,
  });
  // ... join with User.department via separate query, then aggregate

  // Alternative: use $queryRawUnsafe for a single efficient query
  const deptRows = await prisma.$queryRawUnsafe<{ department: string; orders: bigint; qty: bigint }[]>(
    `SELECT u."department", COUNT(DISTINCT o.id)::bigint AS orders,
            COALESCE(SUM(oi."quantity"), 0)::bigint AS qty
     FROM "Order" o
     JOIN "User" u ON u.id = o."studentId"
     JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o."createdAt" >= $1
     GROUP BY u."department"
     ORDER BY orders DESC`,
    thirtyDaysAgo
  );

  // Similar for dietary preference
  const dietRows = await prisma.$queryRawUnsafe<{ preference: string; orders: bigint; qty: bigint }[]>(
    `SELECT u."dietaryPreference" AS preference, COUNT(DISTINCT o.id)::bigint AS orders,
            COALESCE(SUM(oi."quantity"), 0)::bigint AS qty
     FROM "Order" o
     JOIN "User" u ON u.id = o."studentId"
     JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o."createdAt" >= $1
     GROUP BY u."dietaryPreference"
     ORDER BY orders DESC`,
    thirtyDaysAgo
  );

  return {
    period: { from: thirtyDaysAgo.toISOString().split("T")[0], to: today.toISOString().split("T")[0] },
    byDepartment: deptRows.map(r => ({ department: r.department, orderCount: Number(r.orders), quantitySold: Number(r.qty) })),
    byDietaryPreference: dietRows.map(r => ({ preference: r.preference, orderCount: Number(r.orders), quantitySold: Number(r.qty) })),
  };
}
```

### Heatmap Cell Component Pattern

```tsx
// Each cell in the WastageHeatmap
function HeatmapCell({ day }: { day: WastageDay }) {
  const [showDetail, setShowDetail] = useState(false);

  if (day.wasteRate === null) {
    return <td className="text-center text-xs text-[var(--text-disabled)]">—</td>;
  }

  const colorClass = day.wasteRate > 15
    ? "bg-red-500/20 text-red-400"
    : day.wasteRate >= 8
      ? "bg-amber-500/20 text-amber-400"
      : "bg-emerald-500/20 text-emerald-400";

  return (
    <td className="text-center relative">
      <button
        onClick={() => setShowDetail(!showDetail)}
        className={`px-2 py-1.5 rounded text-xs font-mono font-semibold cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
        title={`${day.wastage?.toFixed(3)} ${unit} waste`}
      >
        {day.wasteRate.toFixed(1)}%
      </button>
      <AnimatePresence>
        {showDetail && (
          <motion.div ...>
            {/* Raw data card */}
            <p>Opening: {day.openingStock} {unit}</p>
            <p>Received: {day.receivedStock ?? 0} {unit}</p>
            ...
          </motion.div>
        )}
      </AnimatePresence>
    </td>
  );
}
```

### Admin UI Pattern

Follow the existing `AdminDashboardClient.tsx` and `InventoryClient.tsx` patterns:

```
src/app/admin/analytics/
└── page.tsx                    # RSC: auth guard, initial data fetch
```

The page renders two client components:
```tsx
// page.tsx (RSC)
export default async function AdminAnalyticsPage() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") redirect("/forbidden");

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      <Header userName={session.user.name} />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <WastageHeatmap />
        <DemandSegments />
      </div>
    </div>
  );
}
```

### Styling Standards

- **Glassmorphism cards** for heatmap and chart containers
- **Dark theme aesthetic** consistent with existing Admin pages
- **Recharts** with dark theme colors: `oklch(0.62 0.19 250)` for bars, `oklch(0.62 0.19 80)` for amber, etc.
- **Heatmap table** uses `overflow-x-auto` on mobile, sticky first column for ingredient names
- **Framer Motion** for cell detail overlay enter/exit animations
- **Responsive:** Charts stack vertically on 375px, side-by-side on 768px+

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.5]
- [Source: _bmad-output/planning-artifacts/prds/prd-canteen_system-2026-08-03/prd.md — §4.8, FR-31, FR-32, NFR-8]
- [Source: _bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md — AD-1, AD-2, AD-11]
- [Source: _bmad-output/planning-artifacts/architecture/SOLUTION-DESIGN.md — §6.5 Wastage Prediction Logic]
- [Source: prisma/schema.prisma — InventoryRecord, Ingredient, Order, OrderItem, User models]
- [Source: src/lib/inventory.ts — buildInventoryRows, IngredientInventoryRow]
- [Source: src/lib/date-utils.ts — Colombo timezone date utilities]
- [Source: src/components/admin/HourlySalesChart.tsx — Existing Recharts pattern]
- [Source: src/components/admin/ItemSalesList.tsx — Existing Recharts pattern]
- [Source: src/app/admin/inventory/InventoryClient.tsx — Client Component pattern with data fetching]
- [Source: src/app/admin/dashboard/AdminDashboardClient.tsx — Dashboard nav button pattern]
- [Source: _bmad-output/implementation-artifacts/7-4-cook-plan-generation.md — Previous story patterns]
- [Source: _bmad-output/implementation-artifacts/7-3-ml-forecast-engine.md — Previous story patterns]
- [Source: _bmad-output/implementation-artifacts/7-1-inventory-stock-entry-forecasting-view.md — Inventory record patterns]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (DeepSeek V4 Pro)

### Implementation Plan

1. Analytics data library: aggregation queries for wastage + demand ✅
2. API routes: wastage data + demand segments ✅
3. Wastage Heatmap component: color-coded table with cell detail overlay ✅
4. Demand Segments component: bar chart + pie chart ✅
5. Admin Analytics page: RSC shell ✅
6. Dashboard nav button ✅

### Completion Notes

- All 7 tasks completed with zero new lint errors across 7 files (6 new, 1 modified)
- No Prisma schema changes — all data from existing `InventoryRecord`, `Order`, `OrderItem`, `User` tables
- `analytics.ts`: `getWastageData()` queries 7 days of InventoryRecords per active ingredient, calculates waste rate = `(wastage / (openingStock + receivedStock)) × 100`; `getDemandSegments()` uses `$queryRawUnsafe` for efficient JOIN aggregation (NFR-8 compliant — no individual student data)
- 2 API routes: `GET /api/admin/analytics/wastage` + `GET /api/admin/analytics/demand-segments` — both secured with `requireApiRole("ADMIN")`
- `WastageHeatmap.tsx`: Color-coded table with sticky first column, horizontal scroll for mobile, cell tap → Framer Motion detail overlay showing raw figures (Opening/Received/Consumed/Closing/Wastage), Red (>15%) / Amber (8-15%) / Green (<8%) legend
- `DemandSegments.tsx`: Recharts `BarChart` for department breakdown (ICT/ET/BST with distinct colors), `PieChart` (donut) for dietary preference breakdown, dark theme tooltips matching existing `HourlySalesChart` pattern, legend for pie chart, responsive grid layout
- Admin Analytics page at `/admin/analytics` — RSC shell with glassmorphism header, loads WastageHeatmap + DemandSegments client components
- Dashboard: "Analytics" nav button added with `BarChart3` icon alongside existing nav buttons

## Change Log

- 2026-08-09: Story 7.5 created — ready for development
  - Comprehensive story file with:
    - 5 acceptance criteria covering wastage heatmap, color coding, cell detail overlay, demand by department, demand by dietary preference
    - Zero schema changes — all data from existing tables
    - 2 new API routes (wastage, demand-segments)
    - Analytics data library with NFR-8 compliant aggregation queries
    - Wastage Heatmap component with Red/Amber/Green color coding and cell tap detail overlay
    - Demand Segments component with Recharts BarChart + PieChart
    - Admin Analytics page at /admin/analytics
    - 7 tasks, 7 files (6 new, 1 modified)
