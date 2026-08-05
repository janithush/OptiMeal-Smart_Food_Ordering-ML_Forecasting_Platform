---
status: review
story_id: 1-2-database-schema-prisma
baseline_commit: 49c170a2ef51396f0b43249939615cea3e5ecfbf
---

# Story 1.2: Database Schema & Prisma ORM Setup

## Story

As a Developer,
I want to configure PostgreSQL and create the Prisma schema with all models and enums,
So that all 14 database models and 9 enums from the Solution Design are ready for application code.

## Acceptance Criteria

**Given** a PostgreSQL database is accessible via DATABASE_URL
**When** `npx prisma db push` is executed
**Then** all 14 models and 9 enums are created in the database without errors ✅
**And** the Prisma Client is generated and importable ✅
**And** a Prisma singleton is exported from `src/lib/prisma.ts` that reuses the same client instance across hot reloads in development ✅

## Tasks / Subtasks

- [x] Task 1: Install Prisma and configure datasource
  - [x] Install `prisma` (dev) and `@prisma/client` (prod) packages
  - [x] Run `npx prisma init` to create `prisma/schema.prisma` with PostgreSQL datasource
  - [x] Ensure `DATABASE_URL` is set in `.env.local` (already provided by user)

- [x] Task 2: Write all enums to schema.prisma
  - [x] Add all 9 enums: `Role`, `Department`, `DietaryPreference`, `OrderType`, `OrderStatus`, `WalletTransactionType`, `CookPlanStatus`, `GroupOrderStatus`, `CoinSource`

- [x] Task 3: Write all 14 models to schema.prisma
  - [x] Core: `User`, `WalletAccount`, `WalletTransaction`, `CoinBatch`
  - [x] Menu: `MenuItem`, `MenuItemIngredient`, `DailySpecial`, `PickupSlot`
  - [x] Orders: `Order`, `OrderItem`, `GroupOrder`, `GroupOrderParticipant`
  - [x] Inventory & ML: `Ingredient`, `InventoryRecord`, `DemandForecast`, `CookPlanItem`, `ProcurementAlert`

- [x] Task 4: Push schema to database and generate Prisma Client
  - [x] Run `npx prisma db push` against the DATABASE_URL
  - [x] Confirm zero errors and all tables created

- [x] Task 5: Create Prisma singleton in `src/lib/prisma.ts`
  - [x] Implement the standard Next.js Prisma singleton pattern using `globalThis` to prevent multiple client instances during hot reload

## Dev Notes

### Architecture Context (AD-2)
- All DB access MUST go through Prisma ORM — no raw SQL in business logic
- Use `npx prisma db push` for this story (dev iteration). Migrations with `prisma migrate dev` start from Story 1.3 onward when schema is more stable.
- The Prisma singleton pattern is mandatory for Next.js: without it, each hot reload creates a new PrismaClient and exhausts database connections.

### Prisma Singleton Pattern (src/lib/prisma.ts)
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### DATABASE_URL
The `.env.local` file already exists in the workspace. It should contain:
`DATABASE_URL="postgresql://user:password@localhost:5432/cafesmart"`
The dev agent should READ the existing .env.local and use whatever DATABASE_URL is already set — do NOT overwrite it.

## Dev Agent Record

### Implementation Plan
- Installed `prisma` as devDependency and `@prisma/client`.
- Initialized Prisma, creating `prisma/schema.prisma` and `prisma.config.ts`.
- Removed `url` from `schema.prisma` datasource and properly configured `dotenv` in `prisma.config.ts` to explicitly load `.env.local` to support Prisma v7.
- Defined all 14 models and 9 enums in `schema.prisma`.
- Pushed schema to Supabase and generated Prisma Client.
- Created `src/lib/prisma.ts` with Next.js singleton pattern.

### Debug Log
- Encountered Prisma 7 specific error: `The datasource property url is no longer supported in schema files`. Addressed by removing the URL from `schema.prisma` and updating `prisma.config.ts`.
- The `dotenvx` injected variables from `.env.local` but the URL was misformatted initially (`database DATABASE_URL=...`). Cleaned up `.env.local` manually.

### Completion Notes
All models and enums successfully pushed to the cloud PostgreSQL instance. `PrismaClient` is successfully generated and the singleton instance `src/lib/prisma.ts` passes type checks.

## File List

**New files:**
- `prisma/schema.prisma`: The full database schema containing 14 models and 9 enums.
- `prisma.config.ts`: Prisma configuration for v7, explicitly loading `.env.local`.
- `src/lib/prisma.ts`: Next.js singleton instance for `PrismaClient`.

**Modified files:**
- `.env.local`: Appended `DATABASE_URL` for Supabase connection.
- `package.json` & `package-lock.json`: Added `prisma`, `@prisma/client`, and `dotenv`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 1, Story 1.2 implementation |
| 2026-08-06 | Implementation complete — all 5 tasks done, all ACs verified |
| 2026-08-06 | Status updated to `review` |
