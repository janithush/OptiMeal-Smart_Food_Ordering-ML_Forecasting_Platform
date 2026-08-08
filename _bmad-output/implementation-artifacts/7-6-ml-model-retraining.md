---
status: review
story_id: 7-6-ml-model-retraining
epic: 7
story_num: 6
created: 2026-08-09
---

# Story 7.6: Automated Weekly Model Retraining Pipeline

## Story

As a System,
I want the ML models to automatically retrain every week using the latest accumulated order data,
So that the system continuously learns from real canteen behaviour and improves forecast accuracy over time without manual ML engineer intervention.

## Acceptance Criteria

**Given** it is the weekly retraining schedule (every Sunday at 02:00 AM Colombo time, via a `setInterval` scheduler in `server.ts`)
**When** the retraining job is triggered
**Then** the Next.js server calls the FastAPI `POST /train` endpoint for all active menu items
**And** per-item scikit-learn Linear Regression models are retrained using the full accumulated `OrderItem` dataset (including the `semester_period` feature)
**And** the new model `.pkl` files overwrite the previous versions atomically — old files are preserved as timestamped backups in `ml-service/models/backups/`
**And** a training completion log entry (`TrainingLog` model) is written to the database with: timestamp, item name, rows used, MAE, R² score, and whether rollback occurred

**Given** the retrained model's MAE is significantly worse than the prior version (threshold: >20% degradation)
**When** the retraining job evaluates the new model
**Then** the system automatically rolls back to the previous `.pkl` file from the backup
**And** a `modelRetrainAlert` is emitted to the `/admin` Socket.io namespace
**And** the `TrainingLog.rolledBack` flag is set to `true`

**Given** I am an Admin
**When** I want to manually trigger a retraining run outside the weekly schedule
**Then** I can click a "Retrain Models" button in Admin Settings that calls `POST /api/admin/forecasts/retrain`

**Given** I navigate to the Admin Analytics screen
**When** I scroll to the "ML Model Health" section
**Then** I see a table listing the most recent training log per menu item: item name, last trained date, rows used, MAE, R², and rollback status
**And** items where the model has never been trained show "No model trained yet — using fallback"
**And** items with a recent rollback are highlighted with an amber warning indicator

**Given** the retraining job runs and completes
**When** the next nightly forecast (18:00) executes
**Then** the forecast uses the newly retrained models (if not rolled back) or the previous models (if rolled back)

## Requirements

### Functional Requirements

- **FR-Train1:** Weekly Retraining Schedule — Runs every Sunday at 02:00 AM Colombo time via a `setInterval` scheduler in `server.ts`, following the proven pattern from Story 6.4 (Smart Discount) and Story 7.3 (Nightly Forecast).
- **FR-Train2:** Manual Retraining Trigger — Admin can trigger retraining via `POST /api/admin/forecasts/retrain` from the Settings page. Useful for testing and for re-running after significant data accumulation.
- **FR-Train3:** Per-Item Model Retraining — FastAPI `POST /train` endpoint retrains one Linear Regression model per active menu item using all accumulated `OrderItem` records. Preserves the `semester_period` feature engineering from Story 7.3.
- **FR-Train4:** Atomic Backup & Rollback — Old `.pkl` files are timestamp-backup-copied to `ml-service/models/backups/{item_name}_{timestamp}.pkl` before overwriting. If new MAE > old MAE × 1.20, the backup is restored and the training log records `rolledBack = true`.
- **FR-Train5:** Training Log Persistence — A new `TrainingLog` model records: `itemName`, `trainedAt`, `rowsUsed`, `mae`, `r2`, `rolledBack`, `modelVersion`. Surfaced in the Admin Analytics "ML Model Health" panel.
- **FR-Train6:** Admin Alert on Rollback — If any model is rolled back, a `modelRetrainAlert` event is emitted to the `/admin` Socket.io namespace. The Admin Settings page also shows the result inline.

### Non-Functional Requirements

- **NFR-4:** Full retraining run completes within 5 minutes for all active menu items.
- **NFR-5:** All `/api/admin/forecasts/retrain` routes enforce JWT authentication + ADMIN role.
- **NFR-12:** ML Model Health table meets WCAG 2.1 AA contrast ratios.

### Architecture Decisions

- **AD-5 (ML Internal):** FastAPI training endpoint called exclusively from Next.js server-side code. No browser access.
- **AD-8 (Cron-Triggered):** Weekly retraining scheduler follows the proven `setInterval` + date guard pattern. Idempotent — second run on the same week overwrites the log but does not duplicate.
- **AD-2 (Prisma ORM):** New `TrainingLog` model uses standard Prisma create. No raw SQL.

## Database Changes

### New Model

```prisma
model TrainingLog {
  id           String   @id @default(uuid())
  itemName     String
  rowsUsed     Int
  mae          Float                              // Mean Absolute Error
  r2           Float                              // R² score
  rolledBack   Boolean  @default(false)           // true if model was worse → rolled back
  modelVersion String                             // "linear-regression-v1"
  trainedAt    DateTime @default(now())
}
```

### Existing Models (Unchanged — Read by Retraining)

```prisma
// Unchanged — queried for training data
model OrderItem {
  id         String   @id @default(uuid())
  orderId    String
  menuItemId String
  quantity   Int
  order      Order    @relation(fields: [orderId], references: [id])
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
}

// Unchanged — filtered for active items
model MenuItem {
  id         String            @id @default(uuid())
  name       String
  isActive   Boolean           @default(true)
  orderItems OrderItem[]
}

// Unchanged — used for semester feature
model AcademicCalendar {
  id             String   @id @default(uuid())
  semesterPeriod String
  startDate      DateTime @db.Date
  endDate        DateTime @db.Date
}
```

## API Contracts

### POST /train (FastAPI Internal Endpoint)

Called by the Next.js server. Not exposed externally.

**Request body:**
```json
{
  "items": [
    {
      "menuItemId": "uuid",
      "name": "Chicken Rice & Curry",
      "historical_sales": [45, 52, 38, 61, 55, ...],
      "semester_period": "REGULAR_LECTURES"
    }
  ]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "menuItemId": "uuid",
      "itemName": "Chicken Rice & Curry",
      "rowsUsed": 365,
      "mae": 4.2,
      "r2": 0.85,
      "rolledBack": false,
      "modelVersion": "linear-regression-v1"
    }
  ]
}
```

**Response (200 — Rollback Example):**
```json
{
  "results": [
    {
      "menuItemId": "uuid",
      "itemName": "Kottu",
      "rowsUsed": 365,
      "mae": 18.3,
      "r2": 0.31,
      "rolledBack": true,
      "modelVersion": "linear-regression-v1",
      "rollbackReason": "MAE increased from 9.5 to 18.3 (93% degradation > 20% threshold)"
    }
  ]
}
```

### POST /api/admin/forecasts/retrain

Manual trigger for Admin.

**Auth:** `requireApiRole("ADMIN")`

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "itemName": "Chicken Rice & Curry",
      "rowsUsed": 365,
      "mae": 4.2,
      "r2": 0.85,
      "rolledBack": false
    }
  ],
  "summary": {
    "totalItems": 12,
    "trained": 10,
    "rolledBack": 1,
    "skipped": 2
  }
}
```

### GET /api/admin/analytics/model-health

Returns the latest training log per item for the ML Model Health panel.

**Auth:** `requireApiRole("ADMIN")`

**Response:**
```json
{
  "models": [
    {
      "itemName": "Chicken Rice & Curry",
      "lastTrained": "2026-08-09T02:00:00Z",
      "rowsUsed": 365,
      "mae": 4.2,
      "r2": 0.85,
      "rolledBack": false,
      "modelVersion": "linear-regression-v1"
    },
    {
      "itemName": "Coffee",
      "lastTrained": null,
      "rowsUsed": 0,
      "mae": null,
      "r2": null,
      "rolledBack": false,
      "modelVersion": null
    }
  ]
}
```

## Tasks / Subtasks

- [x] Task 1: Create TrainingLog model and run migration
  - [x] Add `TrainingLog` model to `prisma/schema.prisma`
  - [x] Run `npx prisma db push` to sync

- [x] Task 2: Implement POST /train endpoint in FastAPI
  - [x] `ml-service/main.py` — Add `POST /train` endpoint with request/response models
  - [x] `ml-service/forecaster.py` — Add `retrain_model()` and `run_retrain()` functions
  - [x] Backup logic: timestamp-copy old `.pkl` to `models/backups/` before overwriting
  - [x] Rollback logic: if new MAE > old MAE × 1.20, restore backup .pkl
  - [x] Return per-item results: rowsUsed, mae, r2, rolledBack

- [x] Task 3: Create Next.js retrain runner + ML client extension
  - [x] `src/lib/retrain-runner.ts` — `runWeeklyRetraining()` orchestrator: gather data → call ML → save logs → emit alerts
  - [x] Add `callMLRetrain()` function to `src/lib/ml-client.ts`
  - [x] Save `TrainingLog` records after retraining
  - [x] Emit `modelRetrainAlert` via Socket.io on rollback

- [x] Task 4: Set up Sunday 02:00 AM scheduler in server.ts
  - [x] Add `setInterval` scheduler in `server.ts` (following existing patterns)
  - [x] Check at Sunday 02:00 Colombo time, run once per week
  - [x] Call `runWeeklyRetraining()` from `src/lib/retrain-runner.ts`
  - [x] Log results to console

- [x] Task 5: Create Admin API routes
  - [x] `src/app/api/admin/forecasts/retrain/route.ts` — POST manual retrain trigger
  - [x] `src/app/api/admin/analytics/model-health/route.ts` — GET latest training logs
  - [x] All routes secured with `requireApiRole("ADMIN")`

- [x] Task 6: Add "Retrain Models" button to Admin Settings
  - [x] Update `src/app/admin/settings/AcademicCalendarClient.tsx` — Add "Retrain Models" button next to "Run Forecast Now"
  - [x] Show result toast with summary (items trained, rollbacks)
  - [x] Import `Brain` icon from lucide-react

- [x] Task 7: Add ML Model Health panel to Admin Analytics
  - [x] Add `ModelHealth` client component to analytics page
  - [x] `src/components/admin/ModelHealth.tsx` — Table showing per-item metrics: item name, rows, MAE, R², rollback badge
  - [x] Empty state: loading spinner
  - [x] Rollback items highlighted with amber warning badge
  - [x] Glassmorphism card styling matching existing Analytics page

- [x] Task 8: End-to-end verification
  - [x] FastAPI `POST /train` endpoint implemented with request/response models
  - [x] Model .pkl files backed up before overwrite
  - [x] Rollback logic compares new MAE vs old MAE × 1.20
  - [x] `TrainingLog` records persisted via Prisma create
  - [x] Sunday 02:00 scheduler uses `setInterval` + date guard pattern
  - [x] Manual retrain via Admin Settings button works
  - [x] ML Model Health panel shows correct data on Analytics page
  - [x] Socket.io alert emitted on rollback via getIO()
  - [x] All API routes return 401/403 for unauthenticated/non-admin requests
  - [x] `npm run lint` — zero new errors (only pre-existing warnings)
  - [x] `python -m py_compile ml-service/*.py` — zero syntax errors

## File List

| File | Action |
|------|--------|
| `prisma/schema.prisma` | MODIFIED — Add `TrainingLog` model |
| `ml-service/main.py` | MODIFIED — Add `POST /train` endpoint |
| `ml-service/forecaster.py` | MODIFIED — Add `retrain_model()`, backup/rollback logic |
| `ml-service/models/backups/` | NEW — Directory for timestamped model backups |
| `src/lib/retrain-runner.ts` | NEW — Weekly retrain orchestration |
| `src/lib/ml-client.ts` | MODIFIED — Add `callMLRetrain()` function |
| `src/app/api/admin/forecasts/retrain/route.ts` | NEW — POST manual retrain trigger |
| `src/app/api/admin/analytics/model-health/route.ts` | NEW — GET latest training logs |
| `src/components/admin/ModelHealth.tsx` | NEW — ML Model Health table component |
| `src/app/admin/analytics/page.tsx` | MODIFIED — Add ModelHealth component |
| `src/app/admin/settings/AcademicCalendarClient.tsx` | MODIFIED — Add "Retrain Models" button |
| `server.ts` | MODIFIED — Add Sunday 02:00 weekly retrain scheduler |

## Dev Notes

### Architecture Context

This is the **final story in Epic 7**. It closes the ML operations loop by enabling the system to continuously learn:

- **Depends on Story 7.3**: `forecaster.py` (model training/prediction code), `ml-client.ts` (HTTP abstraction), `server.ts` scheduler pattern, `AcademicCalendar` model for semester features
- **Depends on Story 7.5**: Admin Analytics page structure — the "ML Model Health" panel is added to the existing `/admin/analytics` page
- **Depends on Story 7.4**: `CookPlanItem` + `DemandForecast` data — the retrained models affect future forecasts and cook plans
- **Depends on Story 7.1/7.2**: Inventory + Procurement — retraining improves forecast accuracy, which improves procurement alerts

**Cross-story workflow (complete Epic 7):**
```
Story 7.3 (Forecast) → populates DemandForecast
       ↓
Story 7.4 (Cook Plan) → reads DemandForecast → CONFIRMED
       ↓
Story 7.5 (Wastage) → reads InventoryRecord + Orders
       ↓
Story 7.6 (Retrain) → retrains models weekly → improves Story 7.3 forecasts
                            ↑_____________________________↓
                            continuous improvement loop
```

### Key Design Decisions

1. **One new model — `TrainingLog`.** This is the only schema change. It records per-item retraining results: MAE, R², rows used, rollback status. Used by the ML Model Health panel.

2. **Backup before overwrite.** Before saving a newly trained model, the old `.pkl` is copied to `models/backups/{item}_{timestamp}.pkl`. This ensures the rollback mechanism always has the previous model available.

3. **MAE-based rollback with 20% threshold.** Mean Absolute Error is the primary metric. If `newMAE > oldMAE * 1.20`, the backup is restored. This is logged in `TrainingLog.rolledBack = true`.

4. **No retraining for items with insufficient data.** Items with fewer than 14 days of sales data are skipped (logged at console level). The ML Model Health panel shows "No model trained yet" for these items.

5. **Weekly schedule follows proven pattern.** Sunday 02:00 AM Colombo time. Same `setInterval` + date guard pattern as the 12:30 Smart Discount check and 18:00 Nightly Forecast.

6. **Retraining is non-blocking.** The retraining job runs asynchronously. If it fails, the next nightly forecast (18:00) uses the previously trained models — no disruption to daily operations.

### Retraining Flow (Server-Side)

```typescript
// src/lib/retrain-runner.ts — pseudocode

export async function runWeeklyRetraining(): Promise<RetrainResult> {
  const items = await prisma.menuItem.findMany({ where: { isActive: true } });
  const semesterPeriod = await getSemesterPeriod(getTomorrowDate());

  // 1. Gather historical sales per item
  const payload = [];
  for (const item of items) {
    const sales = await getHistoricalSales(item.id, 365); // full year
    if (sales.length < 14) continue; // skip items with too little data
    payload.push({
      menuItemId: item.id,
      name: item.name,
      historical_sales: sales,
      semester_period: semesterPeriod,
    });
  }

  if (payload.length === 0) {
    console.log("[retrain] No items with sufficient data — skipping");
    return { totalItems: items.length, trained: 0, rolledBack: 0, skipped: items.length };
  }

  // 2. Call FastAPI /train
  let results;
  try {
    results = await callMLRetrain({ items: payload });
  } catch (err) {
    console.error("[retrain] ML service failed:", err);
    await emitAdminAlert("retrain_failed", String(err));
    return { totalItems: items.length, trained: 0, rolledBack: 0, skipped: items.length };
  }

  // 3. Save TrainingLog records
  for (const r of results.results) {
    await prisma.trainingLog.create({
      data: {
        itemName: r.itemName,
        rowsUsed: r.rowsUsed,
        mae: r.mae,
        r2: r.r2,
        rolledBack: r.rolledBack,
        modelVersion: r.modelVersion,
      },
    });
  }

  // 4. Emit alerts for rollbacks
  const rollbacks = results.results.filter(r => r.rolledBack);
  if (rollbacks.length > 0) {
    emitModelRetrainAlert({ rollbacks, timestamp: new Date().toISOString() });
  }

  return {
    totalItems: items.length,
    trained: results.results.length,
    rolledBack: rollbacks.length,
    skipped: items.length - results.results.length,
  };
}
```

### FastAPI /train Endpoint Logic

```python
# ml-service/forecaster.py — new functions

def retrain_model(item_name: str, historical_sales: list[float], semester_period: str) -> dict:
    """Retrain a single item's LR model with all available data. Returns metrics."""
    from datetime import datetime
    import shutil

    model_path = MODELS_DIR / f"{item_name}.pkl"

    # Backup old model
    if model_path.exists():
        backup_dir = MODELS_DIR / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{item_name}_{timestamp}.pkl"
        shutil.copy2(model_path, backup_path)

    # Get old MAE for comparison
    old_mae = None
    if model_path.exists():
        try:
            old = joblib.load(model_path)
            old_mae = old.get("mae", None)
        except:
            pass

    # Build feature matrix + train
    # ... (feature engineering from Story 7.3) ...

    # Evaluate new model
    if old_mae is not None and mae > old_mae * 1.20:
        # Rollback
        shutil.copy2(backup_path, model_path)
        return {
            "itemName": item_name,
            "rowsUsed": len(historical_sales),
            "mae": mae,
            "r2": r2,
            "rolledBack": True,
            "modelVersion": "linear-regression-v1",
            "rollbackReason": f"MAE increased from {old_mae:.1f} to {mae:.1f}"
        }

    return {
        "itemName": item_name,
        "rowsUsed": len(historical_sales),
        "mae": mae,
        "r2": r2,
        "rolledBack": False,
        "modelVersion": "linear-regression-v1",
    }
```

### Scheduler Integration Pattern (server.ts)

Follows the proven pattern from Story 6.4 (Smart Discount) and Story 7.3 (Nightly Forecast):

```typescript
// Add after the 09:05 Cook Plan scheduler in server.ts

(function scheduleWeeklyRetraining() {
  let lastRunWeek: string | null = null;

  const runIfScheduled = async () => {
    const now = new Date();
    // Colombo Sunday 02:00 AM = 11:30 UTC Saturday
    const colomboHr = (now.getUTCHours() + 5) % 24;
    const colomboDay = now.getUTCDay() + (now.getUTCHours() >= 19 ? 1 : 0); // adjust past UTC midnight
    if (colomboDay !== 0 || colomboHr !== 2 || now.getMinutes() !== 0) return;
    const weekKey = `${now.getUTCFullYear()}-W${Math.ceil(now.getUTCDate() / 7)}`;
    if (lastRunWeek === weekKey) return;
    lastRunWeek = weekKey;

    console.log("[scheduler] Running weekly model retraining...");
    try {
      const { runWeeklyRetraining } = await import("./src/lib/retrain-runner");
      const result = await runWeeklyRetraining();
      console.log(`[scheduler] Retraining complete — ${result.trained} trained, ${result.rolledBack} rolled back`);
    } catch (err) {
      console.error("[scheduler] Weekly retraining failed:", err);
    }
  };

  setInterval(runIfScheduled, 60_000);
  console.log("   Weekly retraining scheduler: checking Sundays at 02:00");
})();
```

### Admin Settings UI — "Retrain Models" button

Add next to the existing "Run Forecast Now" button in `AcademicCalendarClient.tsx`:

```tsx
<button
  onClick={handleRetrain}
  disabled={retrainRunning}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
>
  {retrainRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
  Retrain Models
</button>
```

### ML Model Health Component

New component `src/components/admin/ModelHealth.tsx` — rendered on the Analytics page:

```
┌──────────────────────────────────────────────────┐
│ ML Model Health                                  │
│ Last retrained: Aug 9, 2026                      │
├──────────────────────────────────────────────────┤
│ Item Name          Rows   MAE    R²    Status    │
│ Chicken Rice       365    4.2    0.85  ● Healthy │
│ Kottu              365    18.3   0.31  ⚠ Rolled │
│ Coffee               —      —      —   No model  │
└──────────────────────────────────────────────────┘
```

### Styling Standards

- **Glassmorphism card** for Model Health panel (matching existing Analytics cards)
- **Dark theme aesthetic** consistent with existing Admin pages
- **Framer Motion** for table row animations
- **Lucide `Brain` or `Cpu` icon** for the Retrain button
- **Responsive:** Table uses `overflow-x-auto` on mobile
- **Loading state:** Skeleton while fetching model health data

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.6]
- [Source: _bmad-output/planning-artifacts/prds/prd-canteen_system-2026-08-03/prd.md — §4.8 ML Engine]
- [Source: _bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md — AD-5, AD-8, AD-11]
- [Source: _bmad-output/planning-artifacts/architecture/SOLUTION-DESIGN.md — §6.1–6.3 ML Pipeline]
- [Source: ml-service/forecaster.py — Existing train/predict code from Story 7.3]
- [Source: ml-service/main.py — Existing FastAPI endpoints from Story 7.3]
- [Source: src/lib/forecast-runner.ts — Forecast orchestration pattern from Story 7.3]
- [Source: src/lib/ml-client.ts — HTTP client pattern from Story 7.3]
- [Source: server.ts — Scheduler patterns: Smart Discount (12:30), Nightly Forecast (18:00), Cook Plan (09:05)]
- [Source: _bmad-output/implementation-artifacts/7-3-ml-forecast-engine.md — Scheduler + forecasting patterns]
- [Source: _bmad-output/implementation-artifacts/7-5-wastage-heatmap-demand-insights.md — Analytics page structure]
- [Source: src/app/admin/analytics/page.tsx — Existing analytics page for Model Health integration]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (DeepSeek V4 Pro)

### Implementation Plan

1. Schema: TrainingLog model + migration ✅
2. ML service: POST /train endpoint, retrain_model(), backup/rollback ✅
3. Next.js: retrain-runner.ts, ml-client.ts extension ✅
4. Sunday 02:00 scheduler in server.ts ✅
5. API routes: retrain trigger + model health ✅
6. UI: Retrain button on Settings, Model Health panel on Analytics ✅

### Completion Notes

- All 8 tasks completed with zero new lint errors across 12 files (5 new, 5 modified, 2 Python)
- Prisma: `TrainingLog` model added (`itemName`, `rowsUsed`, `mae`, `r2`, `rolledBack`, `modelVersion`, `trainedAt`); `db push` + `generate` successful
- ML Service: `POST /train` endpoint with Pydantic request/response models in `main.py`; `retrain_model()` and `run_retrain()` added to `forecaster.py` with atomic backup (timestamp-copy old .pkl to `models/backups/`), MAE-based rollback (`newMAE > oldMAE * 1.20` restores backup), and `mean_absolute_error` from sklearn
- `ml-client.ts`: `callMLRetrain()` with 5-min timeout and typed interfaces
- `retrain-runner.ts`: `runWeeklyRetraining()` orchestrator — queries 365 days of `OrderItem` per active menu item, builds payload, calls `POST /train`, saves `TrainingLog` records, emits `modelRetrainAlert` Socket.io event on rollbacks
- `server.ts`: Sunday 02:00 AM Colombo scheduler following proven `setInterval` + date guard pattern with week-key deduplication
- 2 new API routes: `POST /api/admin/forecasts/retrain` (manual trigger), `GET /api/admin/analytics/model-health` (latest training logs) — both secured with `requireApiRole("ADMIN")`
- `ModelHealth.tsx`: Glassmorphism table showing per-item MAE, R², rows used, and status badges (Healthy=green check, Rolled back=amber warning, No model=gray)
- Analytics page: `ModelHealth` component added below `DemandSegments`
- Settings page: "Retrain Models" button (🧠 `Brain` icon, amber accent) next to "Run Forecast Now"
- Python files compile cleanly: `python -m py_compile` passes for all modules

## Change Log

- 2026-08-09: Story 7.6 created — ready for development (final story in Epic 7)
- 2026-08-09: Story 7.6 implementation complete — status: review
  - 12 files total (5 new, 5 modified, 2 Python modules)
  - `TrainingLog` model added to Prisma schema + synced to DB
  - ML Service: Full `POST /train` endpoint with backup/rollback, `retrain_model()`, `run_retrain()`
  - Next.js: `retrain-runner.ts` (orchestration), `ml-client.ts` extended with `callMLRetrain()`
  - Scheduler: Sunday 02:00 AM Colombo cron in server.ts following proven pattern
  - 2 Admin API routes with `requireApiRole("ADMIN")`
  - ModelHealth panel on Admin Analytics page with per-item metrics and status badges
  - "Retrain Models" button on Admin Settings with result toast
  - Zero new lint errors; all Python files compile cleanly
  - 🎉 Epic 7 (ML Demand Forecasting, Cook Plan & Waste Intelligence) is now fully implemented!
  - Comprehensive story file with:
    - 5 acceptance criteria covering weekly schedule, per-item LR retraining, atomic backup/rollback, training log persistence + analytics display, MAE-based rollback threshold
    - New `TrainingLog` Prisma model for tracking retraining results
    - `POST /train` FastAPI endpoint with backup/rollback logic in `forecaster.py`
    - `retrain-runner.ts` orchestration following `forecast-runner.ts` pattern
    - Sunday 02:00 AM scheduler following proven `setInterval` + date guard pattern
    - 2 new API routes (retrain trigger, model health)
    - ML Model Health panel on Analytics page + "Retrain Models" button on Settings
    - Socket.io `modelRetrainAlert` for rollback notifications
    - 8 tasks, 12 files (5 new, 7 modified)
