---
status: review
story_id: 7-2-procurement-alerts-pdf-po
baseline_commit: 8b45507c24edd7506efb05d01a9d307e8e0a21b4
last_updated: 2026-08-08 (post-review: two-tier alert system, always-visible dashboard section, updated current stock logic)
---

# Story 7.2: Procurement Alerts & PDF Purchase Orders

## Story

As an Admin,
I want to receive an alert when stock drops below 1 day of forecasted need and generate a PDF PO,
So that I can quickly reorder supplies before they run out.

## Acceptance Criteria

**Given** an ingredient's current stock (most recent `InventoryRecord.closingStock ?? openingStock`) is critically below tomorrow's forecasted need (`currentStock < forecastedNeed`)
**When** the procurement check runs
**Then** a **Critical** (Red) Procurement Alert is generated showing: ingredient name, unit, current stock, forecasted need, deficit, and reorder quantity
**And** the ingredient row on the Inventory page shows a red left border (`border-l-red-500/50`)

**Given** an ingredient's current stock is running low but still above forecasted need (`forecastedNeed ≤ currentStock < forecastedNeed × 1.15`)
**When** the procurement check runs
**Then** a **Warning** (Amber) Procurement Alert is generated indicating the ingredient is approaching its reorder point
**And** the ingredient row on the Inventory page shows an amber left border (`border-l-amber-500/50`)
**And** the alert card shows a lower-priority visual treatment (amber accent, no "Critical" badge)

**Given** an ingredient's stock is healthy (`currentStock ≥ forecastedNeed × 1.15`)
**When** the procurement check runs
**Then** no Procurement Alert is generated for that ingredient

**Given** a Procurement Alert exists for one or more ingredients
**When** I click "Generate Purchase Order"
**Then** a formatted PDF Purchase Order is generated server-side using `@react-pdf/renderer` and downloaded immediately
**And** the PDF includes: canteen name ("CaféSmart — Faculty of Technology"), date, a table listing each procurable ingredient with name, unit, current stock, forecasted need, deficit, and reorder quantity (= deficit rounded up with 10% buffer)
**And** all unresolved alerts for today are marked `isResolved = true` after PDF generation

**Given** I am on the Admin Dashboard
**When** procurement alerts exist or not
**Then** the "Procurement Alerts" section is always visible below the Active Flash Deals section
**And** when no alerts exist, it displays: "All ingredients are adequately stocked."
**And** when alerts exist, it displays per-ingredient alert cards with tier-appropriate colors (amber for Warning, red for Critical)

**Given** I am on the Inventory screen
**When** procurement alerts exist
**Then** alert indicators are shown inline on the ingredient rows with tier-appropriate coloring:
- **Critical** (`currentStock < forecastedNeed`): red left border (`border-l-red-500/50`)
- **Warning** (`forecastedNeed ≤ currentStock < forecastedNeed × 1.15`): amber left border (`border-l-amber-500/50`)
**And** the procurement alert fetch runs automatically on inventory page load (not only on manual refresh)

**Given** no `DemandForecast` exists yet for tomorrow (before the nightly 18:00 run)
**When** the alert check runs
**Then** no alerts are generated (cannot compare stock against non-existent forecast)

## Requirements

### Functional Requirements

- **FR-27:** Procurement Alert & Purchase Order Generation — Two-tier alert system: **Critical** (currentStock < forecastedNeed) and **Warning** (forecastedNeed ≤ currentStock < forecastedNeed × 1.15). Admins generate a PDF Purchase Order listing ingredient, required quantity, and date.
  - **FR-27a:** Procurement Alert appears within 30 minutes of stock crossing either threshold.
  - **FR-27b:** PDF correctly lists all flagged ingredients with quantities + 10% buffer.
  - **FR-27c:** Alert is cleared (isResolved = true) once a PO has been generated.

### Non-Functional Requirements

- **NFR-5:** All `/api/admin/procurement/*` routes enforce JWT authentication + ADMIN role. No client-side-only access control.
- **NFR-1:** Procurement alert cards render within the dashboard's natural load time (no extra delay).
- **NFR-11:** Alert cards and PO button are responsive — fully usable on 375px mobile without horizontal scroll.
- **NFR-12:** All interactive elements meet WCAG 2.1 AA minimum contrast ratios and have visible focus states.

### Architecture Decisions

- **AD-1 (RSC-first):** Procurement alert data is fetched server-side alongside the dashboard/inventory data. The "Generate PO" button triggers a server action or Route Handler that returns a PDF blob.
- **AD-2 (Prisma ORM):** All database access through Prisma Client. Alert creation uses upsert pattern.
- **AD-5 (ML Internal):** No direct ML service calls. Forecasted need read from `DemandForecast` table (populated in Story 7.3). If no forecast exists, no alerts.
- **AD-11 (One writer per entity):** `ProcurementAlerts` — Admin Route Handlers only. PDF generation is server-side only.

## Database Changes

### Existing Models (Schema Changes Required — Post-Review)

The `ProcurementAlert` model requires a `tier` field for the two-tier alert system:

```prisma
// UPDATED — tier field added for two-tier alert system (WARNING | CRITICAL)
model ProcurementAlert {
  id             String     @id @default(uuid())
  ingredientId   String
  ingredient     Ingredient @relation(fields: [ingredientId], references: [id])
  date           DateTime   @db.Date
  currentStock   Decimal    @db.Decimal(8, 3)
  forecastedNeed Decimal    @db.Decimal(8, 3)
  deficit        Decimal    @db.Decimal(8, 3)
  tier           String     @default("CRITICAL")   // "WARNING" | "CRITICAL"
  isResolved     Boolean    @default(false)
  createdAt      DateTime   @default(now())
}

// Ingredient already has the relation
model Ingredient {
  // ... other fields ...
  procurementAlerts ProcurementAlert[]
}

// InventoryRecord — used to read current stock
model InventoryRecord {
  id            String     @id @default(uuid())
  ingredientId  String
  date          DateTime   @db.Date
  openingStock  Decimal    @db.Decimal(8, 3)
  closingStock  Decimal?   @db.Decimal(8, 3)
  // ...
  @@unique([ingredientId, date])
}
```

### Alert Calculation Logic (Two-Tier — Post-Review)

The procurement check runs when an Admin views the Dashboard or Inventory page:

```
FOR each ingredient:
  latestRecord = InventoryRecord WHERE ingredientId = ingredient.id ORDER BY date DESC LIMIT 1
  IF latestRecord exists:
    currentStock = latestRecord.closingStock ?? latestRecord.openingStock
    forecastedNeed = calculateForecastedNeed(ingredient.id, tomorrow)
    IF forecastedNeed.hasForecast:
      IF currentStock < forecastedNeed.total:
        // CRITICAL: stock insufficient for tomorrow
        CREATE/UPDATE ProcurementAlert with tier = "CRITICAL"
        deficit = forecastedNeed.total - currentStock
      ELSE IF currentStock < forecastedNeed.total × 1.15:
        // WARNING: stock approaching reorder point
        CREATE/UPDATE ProcurementAlert with tier = "WARNING"
        deficit = 0 (no actual deficit yet)
      ELSE:
        // Stock is healthy — resolve any existing alerts
        RESOLVE existing alerts for this ingredient
```

**Two-Tier Thresholds:**

| Tier | Condition | Visual | Meaning |
|------|-----------|--------|---------|
| **CRITICAL** (Red) | `currentStock < forecastedNeed` | Red left border, red-accent card | Insufficient for tomorrow — reorder now |
| **WARNING** (Amber) | `forecastedNeed ≤ currentStock < forecastedNeed × 1.15` | Amber left border, amber-accent card | Running low — monitor closely |
| **OK** | `currentStock ≥ forecastedNeed × 1.15` | No indicator | Healthy stock level |

**Current stock source**: Uses `closingStock` if available (most accurate), falls back to `openingStock` as of the most recent InventoryRecord. With the auto-carryover fix from Story 7.1, today's opening stock will be pre-populated from yesterday's closing.

**Reorder Quantity**: `Math.ceil(deficit × 1.10 × 10) / 10` — 10% buffer, rounded up to nearest 0.1 unit. Only applies to CRITICAL-tier alerts (WARNING has deficit=0).

## API Contracts

### GET /api/admin/procurement/alerts

Returns all unresolved procurement alerts for today.

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "ingredientId": "uuid",
      "ingredientName": "Chicken",
      "unit": "kg",
      "date": "2026-08-08",
      "currentStock": 6.0,
      "forecastedNeed": 18.5,
      "deficit": 12.5,
      "tier": "CRITICAL",
      "reorderQty": 13.8,
      "isResolved": false,
      "createdAt": "2026-08-08T09:00:00Z"
    }
  ]
}
```

### POST /api/admin/procurement/check

Triggers a fresh procurement check — compares all ingredients' current stock against tomorrow's forecasted need and creates/updates ProcurementAlert records.

**Response:**
```json
{
  "alertsCreated": 2,
  "alertsResolved": 1,
  "alerts": [
    { "ingredientId": "uuid", "ingredientName": "Chicken", "deficit": 12.5 }
  ]
}
```

### GET /api/admin/procurement/po

Generates and returns a PDF Purchase Order for all unresolved alerts today. Endpoint returns the PDF as a downloadable blob.

**Response:** `application/pdf` binary with `Content-Disposition: attachment; filename="Purchase-Order-2026-08-08.pdf"`

**PDF content layout:**
```
┌─────────────────────────────────────────────┐
│        CaféSmart — Faculty of Technology     │
│           University of Ruhuna               │
│         PURCHASE ORDER                       │
│         Date: August 8, 2026                 │
│         PO #: PO-2026-08-08                  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ Ingredient │ Unit │ Stock │ Need  │ Qty │  │
│  ├──────────────────────────────────────┤    │
│  │ Chicken    │ kg   │ 6.000 │ 18.500│ 13.8│  │
│  │ Rice       │ kg   │ 12.00 │ 25.000│ 14.3│  │
│  └──────────────────────────────────────┘    │
│                                              │
│  Reorder Qty = (Forecasted Need - Current    │
│  Stock) × 1.10 buffer, rounded up to 0.1     │
│                                              │
│  Authorized by: _______________              │
│  Date: _______________                       │
└─────────────────────────────────────────────┘
```

### POST /api/admin/procurement/resolve

Marks all unresolved alerts for today as resolved (called after PDF download, or manually).

**Response:**
```json
{
  "resolved": 2
}
```

## Tasks / Subtasks

- [x] Task 1: Install @react-pdf/renderer and create procurement lib
  - [x] Install `@react-pdf/renderer` package
  - [x] Create `src/lib/procurement.ts` — helper functions: `runProcurementCheck()` (two-tier), `getProcurementAlerts()`, `getProcurableIngredientIds()`, `resolveAllAlerts()`
  - [x] `runProcurementCheck()`: iterate ingredients, two-tier check: CRITICAL if stock < forecastedNeed, WARNING if stock < forecastedNeed × 1.15
  - [x] Reuse `calculateForecastedNeed()` from `src/lib/inventory.ts` (Story 7.1)

- [x] Task 2: Create Procurement Alert API routes
  - [x] `GET /api/admin/procurement/alerts/route.ts` — return unresolved alerts for today
  - [x] `POST /api/admin/procurement/check/route.ts` — trigger fresh procurement check
  - [x] `GET /api/admin/procurement/po/route.tsx` — generate and return PDF PO
  - [x] `POST /api/admin/procurement/resolve/route.ts` — mark alerts as resolved
  - [x] All routes use `requireApiRole("ADMIN")`

- [x] Task 3: Create ProcurementAlertCard component
  - [x] `src/components/admin/ProcurementAlertCard.tsx` — Client Component
  - [x] Display: ingredient name, unit, current stock, forecasted need, deficit, tier badge (WARNING/CRITICAL)
  - [x] Tier-appropriate accent: amber for WARNING, red for CRITICAL
  - [x] "Generate PO" button (primary action for CRITICAL alerts; also available for WARNING)
  - [x] Follow existing SmartDiscountAlert glassmorphism card pattern
  - [x] Responsive: single-column on mobile, wider on desktop

- [x] Task 4: Integrate alerts into Admin Dashboard
  - [x] Fetch alerts via `GET /api/admin/procurement/alerts` on dashboard mount
  - [x] Always render "Procurement Alerts" section (not conditional on alerts.length > 0)
  - [x] Empty state: "All ingredients are adequately stocked." in muted text
  - [x] Display ProcurementAlertCard list with tier-appropriate accent colors
  - [x] "Generate PO" button triggers PDF download flow
  - [x] After download, call `POST /api/admin/procurement/resolve` to clear alerts

- [x] Task 5: Integrate alerts into Inventory page
  - [x] Fetch procurement alerts automatically on inventory page mount (useEffect, not only inside fetchData)
  - [x] Apply tier-appropriate left border on InventoryTableRow:
    - Red (`border-l-red-500/50`) for CRITICAL tier
    - Amber (`border-l-amber-500/50`) for WARNING tier
  - [x] Trigger `POST /api/admin/procurement/check` on inventory page load to ensure alerts are fresh

- [x] Task 6: Create the PDF Purchase Order document definition
  - [x] `src/lib/po-document.tsx` — React component for @react-pdf/renderer
  - [x] Layout: header section, table of procurable items, footer with signature lines
  - [x] Use @react-pdf/renderer `<Document>`, `<Page>`, `<View>`, `<Text>`, `<StyleSheet>`
  - [x] Table columns: Ingredient, Unit, Current Stock, Forecasted Need, Deficit, Reorder Qty (deficit × 1.10, rounded)

- [x] Task 7: End-to-end verification
  - [x] All API routes return 401/403 for unauthenticated/non-admin requests
  - [x] Procurement check creates alerts when stock < forecasted need
  - [x] Procurement check does NOT create alerts when stock >= forecasted need
  - [x] No alerts when no DemandForecast exists (pre-Story 7.3)
  - [x] PDF downloads with correct filename and content
  - [x] Alerts marked resolved after PO generation
  - [x] Dashboard and Inventory pages display alerts
  - [x] Lint check: zero new errors (pre-existing AdminDashboardClient issues unchanged)

## File List

| File | Action |
|------|--------|
| `prisma/schema.prisma` | MODIFIED — Added `tier` to ProcurementAlert; receivedStock/consumedStock to InventoryRecord (shared with 7.1) |
| `src/lib/procurement.ts` | MODIFIED — Two-tier alert logic (WARNING at < forecast×1.15, CRITICAL at < forecast); tier field in queries |
| `src/lib/po-document.tsx` | MODIFIED — Include tier column/badge in PDF; only show reorderQty for CRITICAL alerts |
| `src/app/api/admin/procurement/alerts/route.ts` | MODIFIED — Return tier field in response |
| `src/app/api/admin/procurement/check/route.ts` | MODIFIED — Two-tier check logic |
| `src/app/api/admin/procurement/po/route.tsx` | MODIFIED — Handle tier in PDF generation |
| `src/app/api/admin/procurement/resolve/route.ts` | UNCHANGED |
| `src/components/admin/ProcurementAlertCard.tsx` | MODIFIED — Tier-appropriate accent (amber/red); tier badge; always-visible empty state |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Always render Procurement Alerts section; empty state message |
| `src/app/admin/inventory/InventoryClient.tsx` | MODIFIED — Auto-fetch alerts on mount; trigger procurement check on page load |
| `src/components/admin/InventoryTableRow.tsx` | MODIFIED — Two-tier border: amber for WARNING, red for CRITICAL |
| `package.json` | UNCHANGED — @react-pdf/renderer already installed |

## Dev Notes

### Architecture Context

This is the second story in Epic 7. It builds directly on Story 7.1's inventory tracking:

- **Depends on Story 7.1**: `calculateForecastedNeed()` from `src/lib/inventory.ts` — used to determine if stock is below forecasted need
- **Depends on Story 7.1**: `InventoryRecord` table — used to read current stock levels for each ingredient
- **Enables Story 7.4**: Cook Plan confirmation triggers updated Procurement Alerts and Inventory Forecasted Need columns

**Cross-story workflow:**
```
Story 7.1 (Inventory) → Story 7.2 (Alerts + PO) → Story 7.4 (Cook Plan triggers alerts)
                                                         ↑
                                    Story 7.3 (ML Forecast provides DemandForecast data)
```

### Key Design Decisions

1. **Schema changes required.** `ProcurementAlert` now includes a `tier` field (`"WARNING" | "CRITICAL"`, default `"CRITICAL"`). `InventoryRecord` now includes `receivedStock` and `consumedStock` (from Story 7.1 post-review). A Prisma migration is required.

2. **On-demand check (not cron).** For v1, the procurement check runs when the Admin loads the dashboard or inventory page. A scheduled cron for automatic hourly checks can be added as an enhancement.

3. **Two-tier alert system.**
   - **CRITICAL** (`currentStock < forecastedNeed`): Stock insufficient — red visual, reorder action needed
   - **WARNING** (`forecastedNeed ≤ currentStock < forecastedNeed × 1.15`): Stock approaching reorder point — amber visual, monitor
   - Reorder quantity (10% buffer) applies only to CRITICAL alerts; WARNING has deficit=0

4. **Current stock logic.** Read the most recent `InventoryRecord` for each ingredient (by date DESC). Use `closingStock` if available (more accurate), fall back to `openingStock`.

5. **Dashboard always-visible section.** The "Procurement Alerts" section renders unconditionally (not hidden when empty). Empty state: "All ingredients are adequately stocked."

6. **Automatic alert fetch on inventory page load.** Run `fetchAlerts()` in a `useEffect` on mount (not just inside the manual fetchData callback), ensuring the red/amber borders appear without requiring a manual refresh.

7. **Alert idempotency.** The `runProcurementCheck()` function uses Prisma upsert pattern. Running it multiple times won't create duplicates.

8. **Alert lifecycle.** Procurable → PO generated → Resolved. Resolved alerts stay in the DB as audit records.

### @react-pdf/renderer Setup

```bash
npm install @react-pdf/renderer
```

The PDF document is defined as a React component:

```tsx
// src/lib/po-document.tsx
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  header: { marginBottom: 20, textAlign: "center" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  table: { display: "flex", flexDirection: "column", width: "auto" },
  // ...
});

export function PODocument({ alerts, date }: PODocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header, table, footer */}
      </Page>
    </Document>
  );
}

// In the Route Handler:
const blob = await pdf(<PODocument alerts={alerts} date={date} />).toBlob();
return new NextResponse(blob, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="Purchase-Order-${date}.pdf"`,
  },
});
```

### Reorder Quantity Formula

```
reorderQty = Math.ceil((deficit * 1.10) * 10) / 10
// Rounds up to nearest 0.1 unit with 10% buffer
```

### Styling Standards

- **ProcurementAlertCard**: Follow existing `SmartDiscountAlert` glassmorphism pattern (Story 6.4)
  - `rounded-2xl p-4` with `--glass-bg`, `--glass-blur`, `--glass-border`
  - Glow accent: amber `oklch(0.62 0.19 80)` for standard alerts, red `oklch(0.55 0.20 15)` for critical (deficit > 50% of needed)
  - Icon: `ShoppingBag` or `Package` from lucide-react
- **Inventory table integration**: Red left border (`border-l-2 border-red-500/50`) on rows where an unresolved alert exists
- **Dashboard section**: New section header "Procurement Alerts" below the existing "Active Flash Deals" section. Same glassmorphism card container pattern.
- **Responsive**: Card stacks vertically on mobile, grid on wider screens

### Admin Dashboard Integration Pattern

Following the existing SmartDiscountAlert pattern (Story 6.4):

```tsx
// In AdminDashboardClient.tsx — add new state + fetch
const [procurementAlerts, setProcurementAlerts] = useState<ProcurementAlertPayload[]>([]);
const [poGenerating, setPoGenerating] = useState(false);

// Fetch on mount
useEffect(() => {
  fetch("/api/admin/procurement/alerts")
    .then(r => r.json())
    .then(d => setProcurementAlerts(d.alerts));
}, []);

// Generate PO
const handleGeneratePO = async () => {
  setPoGenerating(true);
  try {
    const res = await fetch("/api/admin/procurement/po");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Purchase-Order-${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    // Resolve alerts
    await fetch("/api/admin/procurement/resolve", { method: "POST" });
    setProcurementAlerts([]);
  } finally {
    setPoGenerating(false);
  }
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.2]
- [Source: _bmad-output/planning-artifacts/prds/prd-canteen_system-2026-08-03/prd.md — §4.7, FR-27]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/ARCHITECTURE-SPINE.md — AD-1, AD-2, AD-5, AD-11]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-canteen_system-2026-08-03/SOLUTION-DESIGN.md — §3 Technology Stack (@react-pdf/renderer 3.x), §4.2 ProcurementAlert model]
- [Source: prisma/schema.prisma — ProcurementAlert, Ingredient, InventoryRecord models]
- [Source: src/lib/inventory.ts — calculateForecastedNeed() from Story 7.1]
- [Source: src/lib/order-events.ts — SmartDiscountAlertPayload pattern]
- [Source: src/components/admin/SmartDiscountAlert.tsx — glassmorphism card pattern]
- [Source: src/app/admin/dashboard/AdminDashboardClient.tsx — dashboard integration pattern]
- [Source: _bmad-output/implementation-artifacts/7-1-inventory-stock-entry-forecasting-view.md — previous story context]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (DeepSeek V4 Pro)

### Implementation Plan

1. Dependency: install `@react-pdf/renderer`
2. Lib: `procurement.ts` — runProcurementCheck, getProcurementAlerts, resolveAllAlerts
3. PDF: `po-document.tsx` — @react-pdf/renderer Document/Page/Text/View
4. API: 4 routes (alerts, check, po, resolve) — all admin-only
5. UI: ProcurementAlertCard component (glassmorphism, like SmartDiscountAlert)
6. Integration: Dashboard section + Inventory row indicators (red left border)

### Completion Notes

- All 7 tasks completed with zero new lint errors across 9 files
- No Prisma schema changes — ProcurementAlert model existed from Story 1.2
- `runProcurementCheck()` reads latest InventoryRecord per ingredient, compares closingStock (or openingStock) against forecasted need from Story 7.1's calculateForecastedNeed()
- Null-safe: skips ingredients with no stock records or no DemandForecast
- PDF generated server-side via @react-pdf/renderer; downloaded as inline download
- Reorder Qty = Math.ceil(deficit × 1.10 × 10) / 10 — 10% buffer, rounded to 0.1
- All routes secured with requireApiRole("ADMIN")
- Procurement alerts section on dashboard below Active Flash Deals
- Inventory rows show red left border when ingredient has unresolved alert
- PO generates single PDF with all unresolved alerts; resolves all after download
- 33 existing unit tests still passing (no regressions)

### File List

| File | Action |
|------|--------|
| `src/lib/procurement.ts` | NEW — runProcurementCheck, getProcurementAlerts, resolveAllAlerts |
| `src/lib/po-document.tsx` | NEW — @react-pdf/renderer PDF document component |
| `src/app/api/admin/procurement/alerts/route.ts` | NEW — GET unresolved alerts |
| `src/app/api/admin/procurement/check/route.ts` | NEW — POST trigger procurement check |
| `src/app/api/admin/procurement/po/route.tsx` | NEW — GET generate PDF PO |
| `src/app/api/admin/procurement/resolve/route.ts` | NEW — POST resolve alerts |
| `src/components/admin/ProcurementAlertCard.tsx` | NEW — Alert card with Generate PO button |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Added procurement alerts section |
| `src/app/admin/inventory/InventoryClient.tsx` | MODIFIED — Added alert indicators via fetchAlerts |
| `src/components/admin/InventoryTableRow.tsx` | MODIFIED — Added hasAlert prop (red left border) |
| `package.json` | MODIFIED — Added @react-pdf/renderer dependency |

## Change Log

- 2026-08-08: Story 7.2 implementation complete
  - 1 new library dependency (@react-pdf/renderer)
  - 4 new API routes (procurement alerts, check, PO generation, resolve)
  - 2 new lib files (procurement helpers, PDF document)
  - 1 new component (ProcurementAlertCard with glassmorphism styling)
  - 3 modified files (dashboard integration, inventory integration, table row indicators)
  - All routes admin-only; no schema changes needed
  - Null-safe checks for missing stock records and forecasts
  - PDF PO with reorder quantity = deficit × 1.10 buffer
- 2026-08-08 (Post-Review Update): Architectural corrections applied
  - Prisma schema: added `tier` field to ProcurementAlert (WARNING | CRITICAL)
  - Two-tier alert system: CRITICAL at `stock < forecastedNeed`, WARNING at `stock < forecastedNeed × 1.15`
  - Dashboard Procurement Alerts section always visible (empty state: "All ingredients are adequately stocked.")
  - Inventory page auto-fetches alerts on mount (not only on manual refresh)
  - Tier-appropriate left borders on InventoryTableRow: amber (WARNING), red (CRITICAL)
  - Tier-appropriate accent colors on ProcurementAlertCard
  - Reorder quantity (10% buffer) only for CRITICAL alerts
