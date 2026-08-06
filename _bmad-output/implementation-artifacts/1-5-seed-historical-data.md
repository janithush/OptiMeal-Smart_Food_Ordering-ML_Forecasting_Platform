---
status: review
story_id: 1-5-seed-historical-data
baseline_commit: 33fbfdcbddcc8f2e6f5c5542c09cbca94080b0fe
---

# Story 1.5: Seed Historical Data (CSV Bootstrap)

## Story

As a Data Engineer,
I want a bootstrap script to ingest the 4 provided HackTrail CSV datasets into PostgreSQL,
So that the ML models have historical data (sales, inventory, queue times, demographics) to train on before the system goes live.

## Acceptance Criteria

**Given** the PostgreSQL database has the CaféSmart schema (all 14 models from Story 1.2)
**When** the bootstrap script `npm run db:seed` is executed
**Then** it parses the 4 CSV files in the `docs/` folder ✅
**And** successfully populates the `Ingredient`, `InventoryRecord`, `Order`, `OrderItem`, and `User` tables with historical records ✅
**And** runs without crashing on foreign key constraints (FK ordering handled correctly) ✅
**And** no duplicate records are created if the seed script is run multiple times (idempotent via upsert checks) ✅

## Tasks / Subtasks

- [x] Task 1: Analyze CSV data and map to Prisma models
  - [x] Create a data mapping plan showing which CSV columns map to which Prisma model fields
  - [x] Identify FK dependencies and determine correct seeding order (Ingredient before InventoryRecord, User before Order, etc.)
  - [x] Handle edge cases: duplicate dates, unknown enum values, empty optional fields

- [x] Task 2: Create the seed script (`prisma/seed.ts`)
  - [x] Add `tsx` to devDependencies if not already present (needed to run TypeScript seed directly)
  - [x] Implement CSV parsing using Node.js built-in `fs` and manual CSV parsing (no external CSV dependency to minimize footprint)
  - [x] Seed `Ingredient` from `inventory_records.csv` and `sales_logs.csv` (deduplicate union)
  - [x] Seed `User` from `student_demographics.csv` (map Department, DietaryPreference to enums)
  - [x] Seed `InventoryRecord` from `inventory_records.csv` (FK to Ingredient)
  - [x] Seed `Order` + `OrderItem` from `sales_logs.csv` — create synthetic historical student orders
  - [x] Make the script idempotent: use upsert patterns (`findFirst` + `create` or check-before-insert) to avoid duplicates on re-run
  - [x] Log progress clearly: number of records inserted per table

- [x] Task 3: Configure the `db:seed` command
  - [x] Add `"db:seed": "tsx prisma/seed.ts"` to `package.json` scripts
  - [x] Add `"prisma": {"seed": "tsx prisma/seed.ts"}` to `package.json` for Prisma CLI compatibility

- [x] Task 4: Run the seed script and verify
  - [x] Run `npm run db:seed` and confirm zero errors
  - [x] Verify row counts via direct DB query
  - [x] Run seed a second time to confirm idempotency (no duplicate inserts)
  - [x] Confirm FK integrity by spot-checking related records

## Dev Notes

### CSV Data Mapping

#### `inventory_records.csv` → `Ingredient` + `InventoryRecord`
| CSV Column | Prisma Model.Field | Notes |
|---|---|---|
| Ingredient | Ingredient.name | Unique. 8 ingredients: Rice, Vegetables, Chicken, Eggs, Bread, Tea Leaves, Milk, Sugar |
| — | Ingredient.unit | "kg" for all except "Milk" → "liters", "Tea Leaves" → "kg" |
| Date | InventoryRecord.date | DateTime @db.Date |
| Stock Level (kg/liters) | InventoryRecord.openingStock | Decimal |
| Wastage (kg/liters) | InventoryRecord.wastage | Decimal |

#### `sales_logs.csv` → `Order` + `OrderItem`
| CSV Column | Prisma Model.Field | Notes |
|---|---|---|
| Item | MenuItem.name | Must create synthetic MenuItem records since no real menu exists yet |
| Date | Order.createdAt | DateTime |
| Quantity Sold | OrderItem.quantity | Creates 1 OrderItem per row |
| — | Order.id | UUID |
| — | Order.type | Default to WALK_IN for historical data |

#### `student_demographics.csv` → `User`
| CSV Column | Prisma Model.Field | Notes |
|---|---|---|
| Student ID | User.id | Use STU001 format directly (not UUID autogen) |
| Department | User.department | Map ICT/ET/BST to enum |
| Dietary Preference | User.dietaryPreference | Map Vegan→VEGAN, Vegetarian→VEGETARIAN, Non-Vegetarian→NON_VEG |
| — | User.email | Synthetic: `{studentId}@fot.ruh.ac.lk` |
| — | User.name | Synthetic: `Student {studentId}` |
| — | User.role | STUDENT |
| — | User.onboardingDone | false |

#### `queue_times.csv` → Storage
This CSV has no matching Prisma model in the current schema. We will create a minimal `QueueTimeRecord` model OR store it in a simpler way. Since the epics reference "ingest all 4 CSVs" — we'll store queue times as parsed data available for the ML service. The simplest approach: create a `QueueTimeRecord` model to hold the raw data.

### Architecture Context

- **AD-2**: All DB access via Prisma. Seed script uses `PrismaClient` directly — no raw SQL.
- **AD-11**: Entity write ownership — seed script acts as "admin" for Ingredient/InventoryRecord creation and creates synthetic student entities.
- The seed script is a one-time bootstrap tool, NOT a migration. It uses `upsert` patterns to be safe for re-runs.

### Seeding Order (FK Dependency Chain)
1. `Ingredient` — no FKs
2. `User` — no FKs
3. `MenuItem` — no FKs (synthetic from sales_logs item names)
4. `InventoryRecord` — FK → Ingredient
5. `Order` — FK → User
6. `OrderItem` — FK → Order + MenuItem

### Important Implementation Notes

1. **CSV Parsing**: Use simple string splitting. All CSV fields are comma-separated with no quoted fields containing commas. No need for a heavyweight CSV library.

2. **Synthetic Users for historical orders**: The sales logs don't reference specific students, so we create generic `historical-system` user and assign all historical orders to it. Student demographic CSV creates real-looking student records independently.

3. **Synthetic MenuItems**: Since the app's real menu doesn't exist yet, create minimal `MenuItem` records for each item name found in `sales_logs.csv`. Use placeholder prices (derived from student_demographics average daily spend data).

4. **Decimal handling**: Prisma `Decimal` type — import `Decimal` from `@prisma/client/runtime/library` or use the `Prisma.Decimal` constructor.

5. **TypeScript execution**: Use `tsx prisma/seed.ts` — `tsx` is already a dev dependency from Story 1.1. Confirm it's available.

6. **The seed command must work with `prisma db seed`**: Prisma reads the `prisma.seed` field from `package.json` to know what command to run. Add both `db:seed` npm script AND the Prisma config entry.

### Previous Stories Context
- **Story 1.2**: Prisma ORM with 14 models is fully deployed. `src/lib/prisma.ts` exports the singleton.
- **Story 1.4**: Python ML service is running — but this story is TypeScript-only (seed is Node.js + Prisma, not Python).

## Dev Agent Record

### Implementation Plan

1. Analyzed 4 CSV files and mapped them to Prisma models: `Ingredient` + `InventoryRecord` from inventory_records.csv, `User` from student_demographics.csv, `Order` + `OrderItem` from sales_logs.csv, `QueueTimeRecord` from queue_times.csv.
2. Created a new `QueueTimeRecord` model in the Prisma schema to hold historical queue time data (date, slotTime, avgWaitMinutes).
3. Installed `@prisma/adapter-pg` and `pg` for Prisma v7 driver adapter requirement, updated `src/lib/prisma.ts` singleton to use `PrismaPg` adapter.
4. Wrote `prisma/seed.ts` with manual CSV parsing (no external library), upsert-based idempotent seeding, and clear console logging.
5. Added `db:seed` script and `prisma.seed` config to `package.json`.
6. Ran seed: 557 total records (8 ingredients, 100 users, 8 menu items, 21 orders, 168 order items, 168 inventory records, 84 queue time records).
7. Verified idempotency: second run correctly skipped all existing records with 0 duplicates.

### Debug Log

- **Prisma v7 driver adapter issue**: Seed script initially failed with `PrismaClientConstructorValidationError` because Prisma v7 requires a driver adapter for standalone scripts. Fixed by installing `@prisma/adapter-pg` + `pg` and updating both `src/lib/prisma.ts` and the seed script.
- **dotenv loading order**: Needed to ensure `dotenv.config()` runs before PrismaClient instantiation. Fixed by inlining the PrismaClient creation in the seed script after the dotenv call.
- **Schema change**: Added `QueueTimeRecord` model to capture queue_times.csv data. Pushed with `npx prisma db push`.

### Completion Notes

All 4 tasks completed with full AC verification. 557 historical records seeded across 6 tables. Seed script is idempotent (verified by rerun). `src/lib/prisma.ts` updated with PrismaPg driver adapter for Prisma v7 compatibility — this also fixes the Next.js server's database connectivity. The project now has a complete historical dataset ready for ML model training in Epic 7.

## File List

**New files:**
- `prisma/seed.ts`: CSV bootstrap script — ingests 4 CSV datasets into PostgreSQL using Prisma ORM.
- (Schema) `QueueTimeRecord` model added to `prisma/schema.prisma`.

**Modified files:**
- `prisma/schema.prisma`: Added `QueueTimeRecord` model for queue_times.csv data.
- `src/lib/prisma.ts`: Updated to use `PrismaPg` driver adapter (required by Prisma v7).
- `package.json`: Added `db:seed` script and `prisma.seed` configuration.
- `package-lock.json`: Added `@prisma/adapter-pg` and `pg` dependencies.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 1, Story 1.5: Seed Historical Data (CSV Bootstrap) |
| 2026-08-06 | Implementation complete — all 4 tasks done, all 4 ACs verified |
| 2026-08-06 | Status updated to `review` |
