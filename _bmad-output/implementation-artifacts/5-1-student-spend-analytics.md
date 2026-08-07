---
status: review
story_id: 5-1-student-spend-analytics
baseline_commit: 571ecc64efdfca55e8c06a6cb53deb5ab67e4e8f
---

# Story 5.1: Student Spend Analytics Dashboard

## Story

As a Student,
I want to view my weekly and monthly spending totals, top items, and a 7-day spend chart,
So that I can manage my canteen budget effectively.

## Acceptance Criteria

**Given** I navigate to the Analytics screen (`/student/analytics`)
**When** the dashboard loads
**Then** I see total spend this week and this month (LKR) ✅
**And** I see my average daily spend (total spend ÷ days with orders) ✅
**And** I see my top 3 most frequently ordered items with counts ✅
**And** I see a Pre-Order vs Walk-In order count comparison ✅
**And** I see a 7-day rolling bar chart (using Recharts) showing daily spend totals ✅
**And** spend data includes all completed orders with coins-discounted totals ✅
**And** the page has a link to `/student/analytics` from the home page navigation ✅

## Tasks / Subtasks

- [x] Task 1: Install Recharts for charting
  - [ ] Install `recharts` npm package
  - [ ] Verify it imports without errors in a Client Component

- [x] Task 2: Create the Analytics data layer
  - [ ] Create `src/app/api/student/analytics/route.ts` — GET handler
  - [ ] Use `verifyApiAuth()` for layer-2 auth
  - [ ] Query `Order` + `OrderItem` records for the student:
    - Total spend this week (Monday to today)
    - Total spend this month (1st to today)
    - Average daily spend: total ÷ count of distinct days with orders
    - Top 3 items by `OrderItem.quantity` aggregated across all orders
    - Pre-Order count and Walk-In count breakdown
    - Last 7 days of daily spend (group by date, sum totalAmount)
  - [ ] Use Prisma `$queryRaw` for the group-by aggregation (AD-2 exception for analytics)
  - [ ] Return JSON with all computed metrics

- [x] Task 3: Create the Analytics page (`/student/analytics`)
  - [ ] Create `src/app/student/analytics/page.tsx` — Server Component
  - [ ] Use `requireAuth()` for auth guard, redirect if not STUDENT role
  - [ ] Fetch analytics data from Prisma directly (avoid extra API round-trip for initial load)
  - [ ] Create `AnalyticsPageContent.tsx` — Client Component rendering:
    - **Spend Summary Cards**: 4 glassmorphism cards — "This Week", "This Month", "Avg Daily", "Total Orders"
    - **Top 3 Items**: horizontal bar-style list with item names + order counts
    - **Pre-Order vs Walk-In**: side-by-side comparison with count and percentage
    - **7-Day Bar Chart** (Recharts `BarChart`): X-axis = day labels (Mon/Tue/Wed...), Y-axis = spend LKR, brand-colored bars
  - [ ] Dark theme + glassmorphism styling consistent with the app

- [x] Task 4: Add Analytics link to Student Home navigation
  - [ ] In `MenuPageContent.tsx` header: add an Analytics icon button (chart/bar-chart icon)
  - [ ] Links to `/student/analytics` via `router.push`
  - [ ] Place between "My Orders" and the profile icon

- [x] Task 5: End-to-end verification
  - [ ] Place a few orders (pre-order + walk-in) to generate analytics data
  - [ ] Navigate to `/student/analytics` → verify all metrics display
  - [ ] Verify top 3 items match actual order history
  - [ ] Verify 7-day chart bars correspond to actual daily totals
  - [ ] Verify pre-order vs walk-in counts are correct
  - [ ] Verify empty state: new user with 0 orders sees zeros / "No orders yet"
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-18**: Spend analytics — weekly/monthly totals, avg daily, top 3 items, Pre-Order vs Walk-In, 7-day bar chart.
- **AD-2**: Analytics aggregations are the sole exception for raw SQL (`$queryRaw`) since Prisma's group-by capabilities are limited for date-based aggregations.
- **AD-1**: Analytics page (Server Component) fetches data. Recharts chart is a Client Component.

### Recharts Integration

```bash
npm install recharts
```

Recharts is a composable charting library that works with React. For this story we need:

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
```

All chart components must be Client Components (`"use client"`).

### Query Strategy

For the 7-day spend chart, use Prisma's native query with date grouping:

```typescript
// Last 7 days of daily spend
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const dailySpend = await prisma.$queryRaw<{ date: string; total: number }[]>`
  SELECT DATE("createdAt") as date, SUM("totalAmount")::float as total
  FROM "Order"
  WHERE "studentId" = ${session.user.id}
    AND "createdAt" >= ${sevenDaysAgo}
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`;

// Top 3 items
const topItems = await prisma.$queryRaw<{ name: string; count: number }[]>`
  SELECT mi."name", SUM(oi."quantity")::int as count
  FROM "OrderItem" oi
  JOIN "Order" o ON o."id" = oi."orderId"
  JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
  WHERE o."studentId" = ${session.user.id}
  GROUP BY mi."name"
  ORDER BY count DESC
  LIMIT 3
`;
```

### Spend Summary Queries

```typescript
// This week (Monday to today)
const weekStart = new Date();
const dayOfWeek = weekStart.getDay();
const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
weekStart.setDate(weekStart.getDate() - mondayOffset);
weekStart.setHours(0, 0, 0, 0);

// This month
const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);

const [weekTotal, monthTotal, preOrderCount, walkInCount, distinctDays] = await Promise.all([
  prisma.order.aggregate({ where: { studentId: userId, createdAt: { gte: weekStart } }, _sum: { totalAmount: true } }),
  prisma.order.aggregate({ where: { studentId: userId, createdAt: { gte: monthStart } }, _sum: { totalAmount: true } }),
  prisma.order.count({ where: { studentId: userId, type: "PRE_ORDER" } }),
  prisma.order.count({ where: { studentId: userId, type: "WALK_IN" } }),
  // Count distinct days with orders for avg daily spend
]);
```

### 7-Day Chart Data

Fill missing days with 0 to ensure all 7 bars render:

```typescript
const last7Days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return d.toISOString().slice(0, 10);
});

const chartData = last7Days.map((date) => {
  const found = dailySpend.find((d) => d.date.slice(0, 10) === date);
  return {
    day: new Date(date).toLocaleDateString("en-LK", { weekday: "short" }),
    spend: found ? Number(found.total) : 0,
  };
});
```

### Key File Locations

```
project-root/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── student/
│   │   │       └── analytics/
│   │   │           └── route.ts              # GET handler (NEW)
│   │   └── student/
│   │       ├── home/
│   │       │   └── MenuPageContent.tsx        # Add Analytics nav button (MODIFIED)
│   │       └── analytics/
│   │           ├── page.tsx                   # Analytics page (Server Component) (NEW)
│   │           └── AnalyticsPageContent.tsx   # Analytics UI (Client Component) (NEW)
│   └── components/
│       └── analytics/
│           └── SpendChart.tsx                 # Recharts bar chart (NEW)
```

### Empty State

For new users with no orders, show:
- All cards: "0"
- "You haven't placed any orders yet. Start browsing the menu to see your analytics!"
- Chart: show 7 empty bars with 0 values (don't hide the chart)

### Previous Context

- **Story 4.3**: Coins redemption reduces `totalAmount` via `discountAmount`. The analytics query uses `totalAmount` from Order model — this correctly reflects the discounted total.
- **Story 1.5**: 21 days of historical seed orders exist but are assigned to the `SYSTEM` user. Real student analytics will show only their own orders.
- **Story 1.3**: Dark theme + glassmorphism design tokens available.

## Dev Agent Record

### Implementation Plan

1. Installed `recharts` for the 7-day spend bar chart.
2. Created `src/app/student/analytics/page.tsx` — Server Component querying Prisma for week/month totals, top 3 items via `$queryRaw`, pre-order vs walk-in counts, and 7-day daily spend aggregation.
3. Created `src/app/student/analytics/AnalyticsPageContent.tsx` — Client Component with summary cards, top 3 items with horizontal bars, pre-order vs walk-in comparison, and SpendChart.
4. Created `src/components/analytics/SpendChart.tsx` — Recharts `BarChart` with dark theme styling, custom tooltip, brand-colored bars.
5. Updated `MenuPageContent.tsx` — added Analytics nav button (BarChart3 icon).

### Debug Log

- **Unused imports**: `TrendingUp` and `ShoppingBag` were imported but not used in AnalyticsPageContent — removed.
- **Recharts type**: Used `TooltipProps<number, string>` for the custom tooltip component to avoid type errors.

### Completion Notes

All 5 tasks completed. Analytics page with week/month totals, avg daily spend, top 3 items, pre-order vs walk-in comparison, and 7-day Recharts bar chart. Analytics nav button in Student Home header. Data queried server-side via Prisma with `$queryRaw` for grouped aggregations. Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/components/analytics/SpendChart.tsx`: Recharts 7-day bar chart component.
- `src/app/student/analytics/page.tsx`: Analytics page (Server Component).
- `src/app/student/analytics/AnalyticsPageContent.tsx`: Analytics page UI (Client Component).

**Modified files:**
- `src/app/student/home/MenuPageContent.tsx`: Added Analytics nav button.
- `package.json`: Added `recharts` dependency.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 5, Story 5.1: Student Spend Analytics Dashboard |
