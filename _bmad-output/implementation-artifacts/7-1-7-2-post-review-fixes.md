# Post-Review Fixes: Stories 7.1 & 7.2

## Overview

This document contains exact instructions to pass to `/bmad-agent-dev` for implementing all architectural corrections identified during the post-implementation review. All decisions have been finalized by the PM.

---

## Prerequisite: Run Prisma Migration

Before any code changes, run the migration for the schema updates:

```
npx prisma migrate dev --name add_received_consumed_stock_and_tier
```

This applies:
- `InventoryRecord`: added `receivedStock Decimal?`, `consumedStock Decimal?`
- `Ingredient`: added `isActive Boolean @default(true)`
- `ProcurementAlert`: added `tier String @default("CRITICAL")`

---

## Fix 1: Correct Wastage Formula + Add Received/Consumed Fields

### Files to modify:
- `src/lib/inventory.ts`
- `src/app/api/admin/inventory/route.ts`
- `src/components/admin/InventoryTableRow.tsx`
- `src/app/admin/inventory/InventoryClient.tsx`
- `src/app/api/admin/inventory/history/route.ts`

### What to do:

1. **`src/lib/inventory.ts`** — Update types and `buildInventoryRows()`:
   - Add `receivedStock: number | null` and `consumedStock: number | null` to `IngredientInventoryRow` interface
   - In `buildInventoryRows()`, return `receivedStock` and `consumedStock` from the record (null if no record)
   - Add new validation functions: `validateReceivedAmount()` and `validateConsumedAmount()` (both >= 0)
   - Add `validateStockAmounts()` should also validate receivedStock and consumedStock

2. **`src/app/api/admin/inventory/route.ts`** — Update POST handler:
   - Accept `receivedStock` (optional number, default null) and `consumedStock` (optional number, default null) from request body
   - Validate both new fields (non-negative if provided)
   - Update wastage calculation:
     ```
     const received = receivedStock ?? 0;
     const consumed = consumedStock ?? 0;
     const wastage = (closingStock !== null) ? openingStock + received - consumed - closingStock : null;
     ```
   - Include `receivedStock` and `consumedStock` in upsert create/update data
   - Return `receivedStock` and `consumedStock` in response

3. **`src/components/admin/InventoryTableRow.tsx`** — Add two new input columns:
   - Add state: `const [received, setReceived] = useState(...)` and `const [consumed, setConsumed] = useState(...)`
   - Add two new `<td>` cells between Opening and Closing columns:
     - "Received" input (type="number", step="0.001", min="0", placeholder="0.000")
     - "Consumed" input (type="number", step="0.001", min="0", placeholder="0.000")
   - Update computed wastage display:
     ```
     const o = parseFloat(opening); const r = parseFloat(received) || 0;
     const c = parseFloat(consumed) || 0; const cl = parseFloat(closing);
     if (!isNaN(o) && !isNaN(cl)) return (o + r - c - cl).toFixed(3);
     ```
   - Send `receivedStock` and `consumedStock` in POST body
   - Mark both new fields as dirty when changed

4. **`src/app/admin/inventory/InventoryClient.tsx`** — Add column headers:
   - Add `<th>Received</th>` and `<th>Consumed</th>` headers between Opening and Closing in both Today and 7-Day History table headers
   - In 7-day history view, display received/consumed values in each cell alongside O/C/W

5. **`src/app/api/admin/inventory/history/route.ts`** — Include new fields:
   - Return `receivedStock` and `consumedStock` in the history response for each ingredient record

---

## Fix 2: Auto-Carryover (Yesterday's Closing → Today's Opening)

### Files to modify:
- `src/lib/inventory.ts`

### What to do:

In `buildInventoryRows()`, after querying today's record, if openingStock is null (no record for today), look up yesterday's record:

```typescript
// Auto-carryover: yesterday's closing → today's opening (today only)
let openingStock = record ? Number(record.openingStock) : null;
if (!record && isSameDay(date, getTodayDate())) {
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prevRecord = await prisma.inventoryRecord.findUnique({
    where: { ingredientId_date: { ingredientId: ingredient.id, date: yesterday } },
  });
  if (prevRecord?.closingStock !== null && prevRecord?.closingStock !== undefined) {
    openingStock = Number(prevRecord.closingStock);
  }
}
```

Key constraint: Only apply carryover when `date` equals today (compare date-only, ignoring time). Do NOT cascade for past dates.

---

## Fix 3: History Cache Invalidation on Save

### Files to modify:
- `src/app/admin/inventory/InventoryClient.tsx`

### What to do:

When `onSaved()` fires (passed as callback to `InventoryTableRow`), clear the history cache:

```typescript
const fetchData = useCallback(async (date?: string) => {
  // ... existing fetch logic ...
  // Invalidate history cache so next manual refresh fetches fresh data
  setHistory([]);
}, [fetchAlerts]);
```

This ensures the user sees fresh data when they toggle to 7-Day History after saving in Today view. The next `fetchHistory()` call will get the updated DB state.

---

## Fix 4: "← Dashboard" Back-Navigation Button

### Files to modify:
- `src/app/admin/inventory/InventoryClient.tsx`

### What to do:

Add a back button in the sticky header, before the existing buttons. Use the `useRouter` hook from `next/navigation` (already likely imported):

```tsx
import { useRouter } from "next/navigation";
// In component:
const router = useRouter();

// In the header, add BEFORE the existing toggle/refresh buttons:
<button
  onClick={() => router.push("/admin/dashboard")}
  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
>
  ← Dashboard
</button>
```

---

## Fix 5: Ingredient CRUD (Add / Rename / Soft-Delete)

### Files to modify:
- `src/app/api/admin/ingredients/route.ts` (existing — add isActive filter)
- `src/app/api/admin/ingredients/[id]/route.ts` (NEW)
- `src/app/admin/inventory/InventoryClient.tsx`
- `src/lib/inventory.ts` (filter active only)

### What to do:

1. **`src/app/api/admin/ingredients/route.ts`** — Update GET/POST:
   - GET: Filter `where: { isActive: true }` by default (active ingredients for daily entry)
   - Add query param `?includeInactive=true` to also return retired ingredients (for management UI)
   - POST: Create new ingredient with `isActive: true` by default

2. **`src/app/api/admin/ingredients/[id]/route.ts`** — NEW file:
   - `PATCH`: Update ingredient `name` and/or `unit`
     ```typescript
     const { name, unit } = body;
     const updated = await prisma.ingredient.update({
       where: { id },
       data: { name: name?.trim(), unit: unit?.trim() },
     });
     ```
   - `DELETE`: Soft-delete — set `isActive = false`
     ```typescript
     await prisma.ingredient.update({
       where: { id },
       data: { isActive: false },
     });
     ```
   - Both secured with `requireApiRole("ADMIN")`

3. **`src/lib/inventory.ts`** — Filter active ingredients:
   - In `buildInventoryRows()`, query ingredients with `where: { isActive: true }` for the daily table
   - For the history API, keep querying all ingredients (active + retired) so historical data is preserved

4. **`src/app/admin/inventory/InventoryClient.tsx`** — Add ingredient management UI:
   - Add an "Add Ingredient" button in the header area
   - Clicking it opens a small inline form or modal: Name input, Unit dropdown (kg/liters), Save button
   - Each ingredient row (or a separate management section) gets:
     - An "Edit" (pencil) icon to rename or change unit inline
     - A "Retire" (archive/trash) icon that sets `isActive = false` with confirmation dialog
   - Retired ingredients should NOT appear in the daily entry table but should remain visible in 7-day history with a "(retired)" label

---

## Fix 6: Two-Tier Procurement Alert System

### Files to modify:
- `src/lib/procurement.ts`
- `src/app/api/admin/procurement/alerts/route.ts`
- `src/app/api/admin/procurement/check/route.ts`
- `src/components/admin/ProcurementAlertCard.tsx`
- `src/components/admin/InventoryTableRow.tsx`
- `src/app/admin/inventory/InventoryClient.tsx`

### What to do:

1. **`src/lib/procurement.ts`** — Update `runProcurementCheck()`:
   ```typescript
   const buffer = 1.15;
   if (currentStock < forecastedNeed) {
     // CRITICAL: Stock insufficient for tomorrow
     const deficit = forecastedNeed - currentStock;
     // Create/update alert with tier = "CRITICAL"
   } else if (currentStock < forecastedNeed * buffer) {
     // WARNING: Stock approaching reorder point but still sufficient
     const deficit = 0; // No actual deficit yet
     // Create/update alert with tier = "WARNING"
   } else {
     // Stock healthy — resolve any existing alert for this ingredient
   }
   ```
   - Update `ProcurementAlertRow` type to include `tier: string`
   - Update `getProcurementAlerts()` to return the `tier` field
   - Update `getProcurableIngredientIds()` to return a `Map<string, string>` (ingredientId → tier) instead of `Set<string>`, so the UI can differentiate colors

2. **`src/app/api/admin/procurement/alerts/route.ts`** — Include `tier` in response JSON

3. **`src/app/api/admin/procurement/check/route.ts`** — Pass tier through the check function

4. **`src/components/admin/ProcurementAlertCard.tsx`** — Tier-appropriate styling:
   - Add `tier` to `ProcurementAlertPayload` interface
   - CRITICAL: red accent `oklch(0.55 0.20 15)`, "Critical" badge
   - WARNING: amber accent `oklch(0.62 0.19 80)`, "Warning" badge
   - Show reorder quantity only for CRITICAL alerts
   - For WARNING, replace "Generate PO" CTA with a lower-priority "Monitor" text or keep the button but deemphasized

5. **`src/components/admin/InventoryTableRow.tsx`** — Two-tier border:
   - Change `hasAlert` prop from `boolean` to `alertTier: string | null`
   - Apply `border-l-2 border-l-red-500/50` for `"CRITICAL"`
   - Apply `border-l-2 border-l-amber-500/50` for `"WARNING"`
   - No border when `null`

6. **`src/app/admin/inventory/InventoryClient.tsx`** — Update alert fetch:
   - Change `procurableIds` state from `Set<string>` to `Map<string, string>` (ingredientId → tier)
   - Update `fetchAlerts()` to build the map
   - Pass `alertTier` (not `hasAlert`) to `InventoryTableRow`
   - Call `fetchAlerts()` in a `useEffect` on mount (not just inside `fetchData()`):
     ```typescript
     useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
     ```

---

## Fix 7: Dashboard Procurement Alerts Always Visible

### Files to modify:
- `src/app/admin/dashboard/AdminDashboardClient.tsx`

### What to do:

Replace the conditional rendering pattern:

**Before:**
```tsx
{procurementAlerts.length > 0 && (
  <div className="space-y-3">
    <h2>Procurement Alerts</h2>
    {procurementAlerts.map(alert => <ProcurementAlertCard ... />)}
  </div>
)}
```

**After:**
```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
      <ShoppingBag className="w-4 h-4 text-amber-400" />
      Procurement Alerts
      {procurementAlerts.length > 0 && (
        <span className="text-[11px] font-normal text-[var(--text-muted)]">
          ({procurementAlerts.length} {procurementAlerts.length === 1 ? "item" : "items"} needs attention)
        </span>
      )}
    </h2>
    <button onClick={fetchProcurementAlerts} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
      Refresh
    </button>
  </div>
  {procurementAlerts.length === 0 ? (
    <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)" }}>
      <p className="text-xs text-[var(--text-muted)]">All ingredients are adequately stocked.</p>
    </div>
  ) : (
    procurementAlerts.map((alert) => (
      <ProcurementAlertCard key={alert.id} alert={alert} onGeneratePO={handleGeneratePO} poGenerating={poGenerating} />
    ))
  )}
</div>
```

---

## Fix 8: Server Restart Resilience (Carryover covers this)

The auto-carryover fix (Fix 2) solves the server restart issue. After restart, when the admin visits /admin/inventory:
- `buildInventoryRows(today)` finds no record for today
- Auto-carryover kicks in and pulls yesterday's closing as today's opening
- The page shows pre-populated opening stock values, not an empty state

No additional code needed beyond Fix 2.

---

## Implementation Order

1. Run Prisma migration
2. Fix 1: Wastage formula + Received/Consumed fields (touches the most files)
3. Fix 2: Auto-carryover
4. Fix 3: History cache invalidation
5. Fix 4: Back-navigation button
6. Fix 5: Ingredient CRUD
7. Fix 6: Two-tier procurement alerts
8. Fix 7: Dashboard always-visible section

## Verification Checklist

After implementation, verify:

- [ ] `npx prisma migrate dev` runs without errors
- [ ] Inventory page shows 6 input columns: Opening, Received, Consumed, Closing, Wastage (computed), Forecasted Need
- [ ] Wastage = Opening + Received − Consumed − Closing (correct math)
- [ ] Yesterday's Closing auto-populates as today's Opening
- [ ] No cascading carryover when navigating to past dates with arrows
- [ ] Saving in Today view clears history cache; next toggle fetches fresh data
- [ ] "← Dashboard" button navigates to /admin/dashboard
- [ ] Can add, rename, and soft-delete ingredients from the inventory page
- [ ] Retired ingredients hidden from daily entry, visible in 7-day history with "(retired)" label
- [ ] CRITICAL alerts show red borders on inventory rows and red-accent cards on dashboard
- [ ] WARNING alerts show amber borders on inventory rows and amber-accent cards on dashboard
- [ ] Dashboard always shows "Procurement Alerts" section (empty state when no alerts)
- [ ] Alert indicators appear automatically on inventory page load (no manual refresh needed)
- [ ] PDF PO includes tier information and reorder quantity only for CRITICAL items
- [ ] Server restart: inventory page still shows pre-populated opening stock (via carryover)
- [ ] All routes return 401/403 for unauthenticated/non-admin requests
- [ ] `npm run lint` — zero new errors
