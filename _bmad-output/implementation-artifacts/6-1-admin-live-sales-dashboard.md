---
status: in-progress
story_id: 6-1-admin-live-sales-dashboard
baseline_commit: TBD
---

# Story 6.1: Admin Live Sales Dashboard (WebSocket)

## Story

As an Admin,
I want a real-time dashboard showing total orders, revenue, and queue depth,
So that I can monitor canteen operations as they happen without manually refreshing the page.

## Acceptance Criteria

**Given** I am logged in as an Admin on the Dashboard screen
**When** a student places an order or top-up
**Then** the dashboard KPIs (Total Orders, Revenue, Pre-Order/Walk-In Split) update instantly via the /admin Socket.io namespace
**And** I see a live hourly sales chart and current pickup slot queue depth
**And** student personal data is completely anonymised in these metrics

## Tasks / Subtasks

- [ ] Task 1: Shape the `dashboardUpdate` Socket.io event
  - [ ] Define `DashboardPayload` interface in `src/lib/order-events.ts`:
    ```typescript
    interface DashboardPayload {
      totalOrders: number;
      totalRevenue: number;
      preOrderCount: number;
      walkInCount: number;
      itemsSold: { name: string; units: number }[];
      hourlySales: { hour: string; orders: number; revenue: number }[];
      slotQueueDepths: { slotId: string; label: string; depth: number; max: number }[];
      updatedAt: string;
    }
    ```
  - [ ] Update `ServerToClientEvents.dashboardUpdate` in `socket-types.ts` to use `DashboardPayload` instead of `Record<string, unknown>`
  - [ ] Create `emitDashboardRefresh()` in `src/lib/order-events.ts` — queries live metrics from Prisma and emits to all `/admin` sockets

- [ ] Task 2: Add JWT auth middleware to `/admin` namespace
  - [ ] In `server.ts`: add `adminNS.use()` middleware (same pattern as `/student` namespace)
  - [ ] Parse `authjs.session-token` cookie, decode JWT payload, verify `role === "ADMIN"`
  - [ ] Reject non-ADMIN connections with `next(new Error("Unauthorized"))`
  - [ ] Store `userId` and `role` on `socket.data`

- [ ] Task 3: Emit dashboard updates after key mutations
  - [ ] In `POST /api/student/orders` — call `emitDashboardRefresh()` after order creation
  - [ ] In `POST /api/wallet/webhook` — call `emitDashboardRefresh()` after successful top-up
  - [ ] In `POST /api/admin/orders/status` — call `emitDashboardRefresh()` after status change

- [ ] Task 4: Create Admin Dashboard API route
  - [ ] Create `src/app/api/admin/dashboard/route.ts` — `GET` returning initial dashboard data
  - [ ] Uses `requireApiRole("ADMIN")` for auth
  - [ ] Queries today's: total orders (count), total revenue (SUM totalAmount), pre-order/walk-in split
  - [ ] Queries: per-item sold units (anonymised), hourly breakdown (GROUP BY hour), slot depths
  - [ ] Returns `DashboardPayload`

- [ ] Task 5: Create the Admin Dashboard UI
  - [ ] Rewrite `src/app/admin/dashboard/page.tsx` as RSC + Client Component split
  - [ ] `page.tsx` — Server Component: auth guard, fetch initial data via `GET /api/admin/dashboard`
  - [ ] `AdminDashboardClient.tsx` — Client Component:
    - KPI cards: Total Orders, Revenue, Pre-Order vs Walk-In ratio
    - Hourly sales bar chart (Recharts, same pattern as SpendChart)
    - Item popularity list (top 5 by units sold)
    - Pickup slot queue depth bars (per slot: current/max)
    - Socket.io client: listen for `dashboardUpdate` → replace state in-place
  - [ ] All styling: glassmorphism cards, dark theme, consistent with existing design

- [ ] Task 6: Create shareable KPI card component
  - [ ] Create `src/components/admin/KpiCard.tsx` — Client Component
  - [ ] Props: `label`, `value`, `subtitle?`, `icon`, `trend?` (up/down/neutral)
  - [ ] Animated number counter on value change (Framer Motion)
  - [ ] Glassmorphism card styling

- [ ] Task 7: End-to-end verification
  - [ ] Log in as Admin → Dashboard loads with current KPIs
  - [ ] Open second browser as Student → place pre-order
  - [ ] Admin dashboard updates within 3 seconds (NFR-3): total orders +1, revenue updates, item count increases, slot depth changes
  - [ ] Student completes top-up → Admin dashboard revenue updates
  - [ ] No student names/emails/IDs visible in any dashboard metrics (NFR-8)
  - [ ] Non-admin user trying to access `/admin/dashboard` → redirected to `/forbidden`
  - [ ] Non-admin user trying to connect to `/admin` WebSocket namespace → rejected
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-22**: Admin live sales dashboard — real-time (WebSocket): total orders, Pre-Order/Walk-In split, revenue, units sold per item, hourly chart, slot queue depth.
- **NFR-3**: Dashboard WebSocket updates arrive within 3 seconds of triggering event.
- **NFR-8**: Student personal data never exposed through Admin analytics — all queries use `$queryRaw` aggregations, never include `User` fields.
- **AD-1 (RSC-first)**: Dashboard page is RSC + Client Component. Initial data fetched server-side; real-time updates via Socket.io client.
- **AD-6**: Socket.io `/admin` namespace now gets JWT auth middleware.

### Data Flow

```
Student places order
       │
       ▼
POST /api/student/orders  ──── creates Order in DB
       │
       ▼
emitDashboardRefresh()
       │
       ▼
Prisma queries aggregations (no student data)
       │
       ▼
io.of("/admin").emit("dashboardUpdate", payload)
       │
       ▼
Admin Dashboard Client Component
  └─ receives payload → updates state → re-renders KPIs/charts
```

### Socket.io Event Contract

```typescript
// Emitted to /admin namespace
interface DashboardPayload {
  totalOrders: number;
  totalRevenue: number;
  preOrderCount: number;
  walkInCount: number;
  itemsSold: { name: string; units: number }[];
  hourlySales: { hour: string; orders: number; revenue: number }[];
  slotQueueDepths: { slotId: string; label: string; depth: number; max: number }[];
  updatedAt: string; // ISO 8601
}
```

### Admin Namespace JWT Auth (server.ts)

```typescript
adminNS.use(async (socket, next) => {
  try {
    const cookieHeader = (socket.request as any).headers.cookie ?? "";
    const token = cookieHeader
      .split("; ")
      .find((c: string) => c.startsWith("authjs.session-token="))
      ?.split("=")[1];
    if (!token) return next(new Error("Unauthorized"));
    
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
    if (payload.role !== "ADMIN") return next(new Error("Forbidden"));
    
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch { next(new Error("Unauthorized")); }
});
```

### Query Strategy (Anonymised)

All dashboard data must be aggregated — never expose individual student data:

```sql
-- Total orders today
SELECT COUNT(*) FROM "Order" WHERE DATE("createdAt") = CURRENT_DATE

-- Revenue today
SELECT SUM("totalAmount") FROM "Order" WHERE DATE("createdAt") = CURRENT_DATE

-- Pre-Order vs Walk-In split
SELECT "type", COUNT(*) FROM "Order" WHERE DATE("createdAt") = CURRENT_DATE GROUP BY "type"

-- Items sold (no student data)
SELECT mi."name", SUM(oi."quantity") as units
FROM "OrderItem" oi
JOIN "MenuItem" mi ON oi."menuItemId" = mi."id"
JOIN "Order" o ON oi."orderId" = o."id"
WHERE DATE(o."createdAt") = CURRENT_DATE
GROUP BY mi."name"
ORDER BY units DESC

-- Hourly sales
SELECT EXTRACT(HOUR FROM o."createdAt") as hour, COUNT(*) as orders, SUM(o."totalAmount") as revenue
FROM "Order" o
WHERE DATE(o."createdAt") = CURRENT_DATE
GROUP BY EXTRACT(HOUR FROM o."createdAt")
ORDER BY hour

-- Slot queue depths
SELECT ps."id", ps."slotTime", ps."currentCount", ps."maxCapacity"
FROM "PickupSlot" ps
WHERE ps."date" = CURRENT_DATE
ORDER BY ps."slotTime"
```

### Key File Locations

```
project-root/
├── server.ts                                    # Add JWT auth to /admin namespace (MODIFIED)
├── src/
│   ├── lib/
│   │   ├── order-events.ts                      # Add emitDashboardRefresh() + DashboardPayload (MODIFIED)
│   │   └── socket-types.ts                      # Shape dashboardUpdate payload (MODIFIED)
│   ├── app/
│   │   ├── api/
│   │   │   └── admin/
│   │   │       └── dashboard/
│   │   │           └── route.ts                 # GET initial dashboard data (NEW)
│   │   │   └── student/
│   │   │       └── orders/
│   │   │           └── route.ts                 # Call emitDashboardRefresh after order (MODIFIED)
│   │   └── admin/
│   │       └── dashboard/
│   │           ├── page.tsx                     # RSC page → auth + fetch (REWRITE)
│   │           └── AdminDashboardClient.tsx     # Client: KPIs + charts + socket (NEW)
│   └── components/
│       └── admin/
│           ├── KpiCard.tsx                      # Animated KPI card (NEW)
│           ├── HourlySalesChart.tsx             # Recharts bar chart (NEW)
│           ├── ItemSalesList.tsx                # Top items sold (NEW)
│           └── SlotQueueBars.tsx               # Per-slot depth bars (NEW)
```

### Important Edge Cases

1. **Zero orders today**: All KPIs show 0 — no crash, no empty chart errors.
2. **First socket connection**: Admin connects before any orders exist — dashboard shows initial data from API, then listens for updates.
3. **Socket reconnect**: On reconnect, the client re-fetches initial data via the API (not via socket — socket only emits deltas).
4. **Multiple admin tabs**: Each tab gets the same broadcast. No conflict.
5. **Non-admin socket attempt**: Rejected with `next(Error("Forbidden"))` — graceful disconnect.
6. **Dashboard query performance**: All queries are bounded to today only. Use `$queryRaw` for GROUP BY efficiency.
7. **Midnight rollover**: At midnight, all counts reset naturally because queries filter by `CURRENT_DATE`.
8. **Hourly chart for incomplete hours**: Shows partial data — the last bar represents the current in-progress hour.
