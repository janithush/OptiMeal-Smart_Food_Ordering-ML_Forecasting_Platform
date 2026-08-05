---
title: CaféSmart — Solution Design
status: draft
created: 2026-08-03
updated: 2026-08-03
project: canteen_system
---

# CaféSmart — Solution Design
## Smart University Canteen System | Faculty of Technology, University of Ruhuna
### HackTrail Challenge Submission

---

## 1. System Overview

CaféSmart is a **closed-loop intelligent canteen ordering platform** built as a mobile-first responsive web application. It eliminates the three core inefficiencies identified in the FoT canteen operational data: 5–20 minute lunch queues, ingredient wastage reaching ~5 kg/item/day, and unpredictable daily demand (3–4× swings for the same menu item).

The system is architected around a **data flywheel**: every student pre-order generates a demand signal, which trains the ML forecast engine, which produces the next day's cook plan, which reduces waste and cost, which is reinvested into better student pricing and loyalty rewards, which drives more pre-orders. Each revolution of the flywheel makes the system smarter.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Mobile-first PWA)                         │
│                                                                               │
│   ┌──────────────────────────┐      ┌──────────────────────────────────┐    │
│   │     Student Interface     │      │       Admin Dashboard             │    │
│   │  (Next.js RSC + React CC) │      │  (Next.js RSC + WebSocket client) │    │
│   └────────────┬─────────────┘      └──────────────┬───────────────────┘    │
└────────────────┼──────────────────────────────────-─┼────────────────────────┘
                 │  HTTPS + JWT                         │  HTTPS + JWT + WS
┌────────────────▼─────────────────────────────────────▼────────────────────────┐
│                     NEXT.JS SERVER  (App Router + Custom Server)               │
│                                                                                │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│   │  Route Handlers   │  │  NextAuth.js      │  │  Socket.io Server          │ │
│   │  /api/student/*   │  │  Google OAuth     │  │  /admin  /student          │ │
│   │  /api/admin/*     │  │  JWT Sessions     │  │  namespaces                │ │
│   │  /api/wallet/*    │  │  Domain Guard     │  └────────────────────────────┘ │
│   └────────┬──────────┘  └──────────────────┘                                │
│            │                                                                   │
│   ┌────────▼──────────┐  ┌────────────────────┐  ┌────────────────────────┐  │
│   │   Prisma ORM       │  │  Wallet Service     │  │  Cron Scheduler        │  │
│   │   (Query Layer)    │  │  (idempotent txns)  │  │  (18:00 forecast run)  │  │
│   └────────┬──────────┘  └────────────────────┘  └──────────┬─────────────┘  │
└────────────┼──────────────────────────────────────────────────┼────────────────┘
             │                                                   │  HTTP (internal)
┌────────────▼──────────┐                             ┌──────────▼─────────────┐
│   PostgreSQL Database  │                             │  Python / FastAPI      │
│                        │                             │  ML Microservice       │
│   All persistent state │                             │  POST /ml/forecast     │
│   Prisma migrations    │◄────────────────────────────│  GET /ml/forecast/:dt  │
└────────────────────────┘   writes DemandForecasts   │  GET /ml/recommend/:id │
                              & CookPlanItems          └────────────────────────┘
                                                                │
                                                     ┌──────────▼─────────────┐
                                                     │  Training Data          │
                                                     │  sales_logs.csv (boot)  │
                                                     │  Live: Orders + Actuals │
                                                     └────────────────────────┘
                                              ┌───────────────────────────────┐
                              PayHere ────────►  /api/wallet/webhook           │
                              Hosted           │  HMAC-MD5 validated           │
                              Checkout         │  Idempotency-keyed credit     │
                                              └───────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Next.js | 14+ (App Router) | SSR, RSC, Route Handlers, middleware — one framework for full stack |
| Language | TypeScript | 5.x | Type safety across shared data contracts (Prisma types → API → UI) |
| Auth | NextAuth.js | v5 (Auth.js) | Google OAuth, JWT sessions, callback hooks for domain restriction |
| ORM | Prisma | 5.x | Type-safe DB access, migration management, strong Next.js integration |
| Database | PostgreSQL | 16 | ACID transactions for wallet operations, JSON support for ML metadata |
| Real-time | Socket.io | 4.x | Namespaced rooms, JWT middleware, persistent connection |
| ML Service | Python + FastAPI | 3.11 / 0.100+ | Scikit-learn for Linear Regression, Pandas for data pipeline, async HTTP |
| ML Libraries | scikit-learn, pandas, numpy | Latest stable | Standard, well-documented, reproducible |
| Payment | PayHere | Hosted Checkout | Sri Lanka payment gateway, HMAC webhook, sandbox support |
| Styling | Tailwind CSS | 3.x | Utility-first, responsive breakpoints, component-level consistency |
| Animation | Framer Motion | 10.x | Micro-animations for premium feel (per design aesthetic requirement) |
| Icons | Lucide React | Latest | Consistent icon set, tree-shakeable |
| Charts | Recharts | 2.x | SSR-compatible, composable, works with RSC |
| PDF | @react-pdf/renderer | 3.x | Server-side PDF generation for Purchase Orders |
| Notifications | Web Push / Polling | — | Service worker Web Push; polling fallback if SW unavailable |
| Hosting | Railway (Next.js) + Railway (Python) | — | Persistent processes required for Socket.io and cron |
| File Storage | Cloudinary | — | Menu item image upload and CDN delivery |

---

## 4. Data Model (PostgreSQL — Prisma Schema)

### 4.1 Entity Relationship Overview

```
Users ──────────── WalletAccount ──── WalletTransactions
  │                                         │
  ├── Orders ────────── OrderItems ──── MenuItems ──── MenuItemIngredients ── Ingredients
  │      │                                 │                                       │
  │      └── PickupSlots            DailySpecials                           InventoryRecords
  │
  ├── CoinBatches
  │
  ├── GroupOrders ─── GroupOrderParticipants
  │
  └── (Admin role) ── CookPlanItems ──── DemandForecasts
                   └── ProcurementAlerts
```

### 4.2 Full Schema Definition

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────

enum Role {
  STUDENT
  ADMIN
}

enum Department {
  ICT
  ET
  BST
}

enum DietaryPreference {
  VEGAN
  VEGETARIAN
  NON_VEGETARIAN
}

enum OrderType {
  PRE_ORDER
  WALK_IN
}

enum OrderStatus {
  CONFIRMED
  IN_PREPARATION
  READY
  COLLECTED
  CANCELLED
}

enum WalletTransactionType {
  TOP_UP
  ORDER_DEDUCTION
  COINS_REDEMPTION
  REFUND
}

enum CookPlanStatus {
  SUGGESTED
  CONFIRMED
  SUPERSEDED
}

enum GroupOrderStatus {
  OPEN
  CONFIRMED
  EXPIRED
}

enum CoinSource {
  WALLET_TOP_UP
  PRE_ORDER_SPEND
}

// ─── Core User ───────────────────────────────────────────────────

model User {
  id                String             @id @default(uuid())
  email             String             @unique
  name              String
  role              Role               @default(STUDENT)
  department        Department?
  dietaryPreference DietaryPreference?
  onboardingDone    Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  wallet            WalletAccount?
  orders            Order[]
  coinBatches       CoinBatch[]
  groupOrders       GroupOrder[]       @relation("OrganizerOrders")
  groupParticipants GroupOrderParticipant[]
}

// ─── Wallet ───────────────────────────────────────────────────────

model WalletAccount {
  id           String               @id @default(uuid())
  userId       String               @unique
  user         User                 @relation(fields: [userId], references: [id])
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
  transactions WalletTransaction[]
}

model WalletTransaction {
  id              String                @id @default(uuid())
  walletId        String
  wallet          WalletAccount         @relation(fields: [walletId], references: [id])
  type            WalletTransactionType
  amount          Decimal               @db.Decimal(10, 2)  // positive=credit, negative=debit
  idempotencyKey  String                @unique              // PayHere order_id or app order_id
  payHereRef      String?
  orderId         String?
  runningBalance  Decimal               @db.Decimal(10, 2)
  createdAt       DateTime              @default(now())
}

// ─── Loyalty Coins ────────────────────────────────────────────────

model CoinBatch {
  id         String     @id @default(uuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id])
  earned     Int
  redeemed   Int        @default(0)
  source     CoinSource
  orderId    String?
  earnedAt   DateTime   @default(now())
  expiresAt  DateTime                          // earnedAt + 90 days
  expired    Boolean    @default(false)
}

// ─── Menu ─────────────────────────────────────────────────────────

model MenuItem {
  id               String            @id @default(uuid())
  name             String
  description      String?           @db.Text
  basePrice        Decimal           @db.Decimal(8, 2)
  dietaryType      DietaryPreference
  imageUrl         String?
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  ingredients      MenuItemIngredient[]
  dailySpecials    DailySpecial[]
  orderItems       OrderItem[]
  cookPlanItems    CookPlanItem[]
  demandForecasts  DemandForecast[]
}

model MenuItemIngredient {
  menuItemId           String
  ingredientId         String
  menuItem             MenuItem   @relation(fields: [menuItemId], references: [id])
  ingredient           Ingredient @relation(fields: [ingredientId], references: [id])
  quantityPerPortion   Decimal    @db.Decimal(8, 4)   // kg or liters per 1 portion

  @@id([menuItemId, ingredientId])
}

model DailySpecial {
  id           String   @id @default(uuid())
  menuItemId   String
  menuItem     MenuItem @relation(fields: [menuItemId], references: [id])
  specialPrice Decimal  @db.Decimal(8, 2)
  description  String?
  date         DateTime @db.Date
  createdAt    DateTime @default(now())

  @@unique([menuItemId, date])
}

// ─── Pickup Slots ─────────────────────────────────────────────────

model PickupSlot {
  id           String    @id @default(uuid())
  date         DateTime  @db.Date
  slotTime     String                           // "11:30", "11:45", ...
  maxCapacity  Int       @default(30)
  currentCount Int       @default(0)
  orders       Order[]

  @@unique([date, slotTime])
}

// ─── Orders ───────────────────────────────────────────────────────

model Order {
  id             String      @id @default(uuid())
  orderNumber    String      @unique                 // "#0142" format
  studentId      String
  student        User        @relation(fields: [studentId], references: [id])
  type           OrderType
  status         OrderStatus @default(CONFIRMED)
  pickupSlotId   String?
  pickupSlot     PickupSlot? @relation(fields: [pickupSlotId], references: [id])
  totalAmount    Decimal     @db.Decimal(10, 2)
  coinsRedeemed  Int         @default(0)
  discountAmount Decimal     @db.Decimal(8, 2) @default(0)
  qrCode         String      @unique
  groupOrderId   String?
  groupOrder     GroupOrder? @relation(fields: [groupOrderId], references: [id])
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  items          OrderItem[]
}

model OrderItem {
  id          String   @id @default(uuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id])
  menuItemId  String
  menuItem    MenuItem @relation(fields: [menuItemId], references: [id])
  quantity    Int
  unitPrice   Decimal  @db.Decimal(8, 2)          // price captured at order time
  subtotal    Decimal  @db.Decimal(10, 2)
}

// ─── Group Orders ─────────────────────────────────────────────────

model GroupOrder {
  id           String           @id @default(uuid())
  code         String           @unique @db.Char(6)
  organizerId  String
  organizer    User             @relation("OrganizerOrders", fields: [organizerId], references: [id])
  pickupSlotId String?
  status       GroupOrderStatus @default(OPEN)
  expiresAt    DateTime                             // createdAt + 30 minutes
  createdAt    DateTime         @default(now())

  participants GroupOrderParticipant[]
  orders       Order[]
}

model GroupOrderParticipant {
  id           String     @id @default(uuid())
  groupOrderId String
  groupOrder   GroupOrder @relation(fields: [groupOrderId], references: [id])
  studentId    String
  student      User       @relation(fields: [studentId], references: [id])
  joinedAt     DateTime   @default(now())

  @@unique([groupOrderId, studentId])
}

// ─── Inventory ────────────────────────────────────────────────────

model Ingredient {
  id          String   @id @default(uuid())
  name        String   @unique
  unit        String                                // "kg" | "liters"
  createdAt   DateTime @default(now())

  menuItems        MenuItemIngredient[]
  inventoryRecords InventoryRecord[]
  procurementAlerts ProcurementAlert[]
}

model InventoryRecord {
  id            String     @id @default(uuid())
  ingredientId  String
  ingredient    Ingredient @relation(fields: [ingredientId], references: [id])
  date          DateTime   @db.Date
  openingStock  Decimal    @db.Decimal(8, 3)
  closingStock  Decimal?   @db.Decimal(8, 3)
  wastage       Decimal?   @db.Decimal(8, 3)        // derived: openingStock - closingStock - sold
  createdAt     DateTime   @default(now())

  @@unique([ingredientId, date])
}

// ─── ML & Forecasting ─────────────────────────────────────────────

model DemandForecast {
  id              String   @id @default(uuid())
  date            DateTime @db.Date
  menuItemId      String
  menuItem        MenuItem @relation(fields: [menuItemId], references: [id])
  predictedQty    Int
  lowEstimate     Int
  highEstimate    Int
  confidenceScore Decimal  @db.Decimal(5, 2)        // 0.00–100.00
  modelVersion    String                             // "linear-regression-v1" | "fallback-actuals"
  generatedAt     DateTime @default(now())

  @@unique([date, menuItemId])
}

model CookPlanItem {
  id             String         @id @default(uuid())
  date           DateTime       @db.Date
  menuItemId     String
  menuItem       MenuItem       @relation(fields: [menuItemId], references: [id])
  forecastQty    Int
  preOrderQty    Int            @default(0)
  finalQty       Int
  bufferQty      Int            @default(0)          // 10% buffer applied
  adminAdjusted  Boolean        @default(false)
  status         CookPlanStatus @default(SUGGESTED)
  confirmedAt    DateTime?
  confirmedBy    String?
  supersededById String?
  createdAt      DateTime       @default(now())

  @@unique([date, menuItemId, status])
}

model ProcurementAlert {
  id             String     @id @default(uuid())
  ingredientId   String
  ingredient     Ingredient @relation(fields: [ingredientId], references: [id])
  date           DateTime   @db.Date
  currentStock   Decimal    @db.Decimal(8, 3)
  forecastedNeed Decimal    @db.Decimal(8, 3)
  deficit        Decimal    @db.Decimal(8, 3)
  isResolved     Boolean    @default(false)
  createdAt      DateTime   @default(now())
}
```

---

## 5. API Contracts

### 5.1 Authentication

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/auth/[...nextauth]` | Public | NextAuth.js handler (Google OAuth flow) |
| POST | `/api/auth/onboarding` | Student | Save department + dietary preference (first login only) |

**Response: POST /api/auth/onboarding**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Kavya Jayasinghe",
    "department": "ICT",
    "dietaryPreference": "VEGETARIAN",
    "onboardingDone": true
  }
}
```

---

### 5.2 Student — Menu

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/menu` | Student | Today's active menu with slot availability |
| GET | `/api/menu/:itemId` | Student | Item detail + slot capacities |

**Query params: GET /api/menu**
- `dietary`: `VEGAN` | `VEGETARIAN` | `NON_VEGETARIAN` (optional, filters results)
- `date`: `YYYY-MM-DD` (optional, defaults to today)

**Response: GET /api/menu**
```json
{
  "date": "2026-08-04",
  "cutoffPassed": false,
  "items": [
    {
      "id": "uuid",
      "name": "Fried Rice",
      "description": "...",
      "price": 350.00,
      "specialPrice": null,
      "dietaryType": "VEGETARIAN",
      "imageUrl": "https://res.cloudinary.com/...",
      "availability": "AVAILABLE",
      "remainingCapacity": 87,
      "slots": [
        { "slotTime": "11:30", "remaining": 24 },
        { "slotTime": "11:45", "remaining": 30 },
        { "slotTime": "12:00", "remaining": 18 }
      ]
    }
  ]
}
```

---

### 5.3 Student — Orders

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/orders` | Student | Create pre-order or walk-in order |
| GET | `/api/orders` | Student | Order history (paginated) |
| GET | `/api/orders/:orderId` | Student | Order detail + QR code data |

**Request: POST /api/orders**
```json
{
  "type": "PRE_ORDER",
  "pickupSlotTime": "12:30",
  "items": [
    { "menuItemId": "uuid", "quantity": 1 },
    { "menuItemId": "uuid", "quantity": 1 }
  ],
  "coinsToRedeem": 50,
  "groupOrderId": null
}
```

**Response: POST /api/orders (201 Created)**
```json
{
  "orderId": "uuid",
  "orderNumber": "#0142",
  "status": "CONFIRMED",
  "pickupSlot": "12:30 – 12:45",
  "totalAmount": 620.00,
  "discount": 50.00,
  "finalAmount": 570.00,
  "coinsEarned": 11,
  "qrCode": "data:image/png;base64,...",
  "walletBalanceAfter": 1430.00
}
```

**Error: 402 Payment Required (insufficient wallet)**
```json
{
  "error": "INSUFFICIENT_WALLET_BALANCE",
  "required": 570.00,
  "available": 320.00,
  "shortfall": 250.00
}
```

---

### 5.4 Student — Wallet

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/wallet` | Student | Balance + last 20 transactions |
| POST | `/api/wallet/topup` | Student | Initiate PayHere top-up session |
| POST | `/api/wallet/webhook` | Public | PayHere payment notification (HMAC validated) |

**Request: POST /api/wallet/topup**
```json
{ "amount": 2000.00 }
```

**Response: POST /api/wallet/topup**
```json
{
  "payHereOrderId": "CS-1722724800-STU001",
  "checkoutUrl": "https://sandbox.payhere.lk/pay/checkout",
  "amount": 2000.00,
  "currency": "LKR"
}
```

**Webhook: POST /api/wallet/webhook (PayHere notifies)**
```
payment_id=xxxxx&order_id=CS-...&payhere_amount=2000.00
&payhere_currency=LKR&status_code=2&md5sig=HMAC...
```
→ Server validates HMAC, credits wallet, emits Socket.io event `wallet:topup_confirmed`.

---

### 5.5 Student — Coins

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/coins` | Student | Balance, batches with expiry dates |

**Response: GET /api/coins**
```json
{
  "totalBalance": 85,
  "batches": [
    {
      "earned": 20,
      "redeemed": 0,
      "remaining": 20,
      "source": "WALLET_TOP_UP",
      "expiresAt": "2026-11-01",
      "daysUntilExpiry": 89
    }
  ]
}
```

---

### 5.6 Student — Analytics & Personalisation

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/analytics/spend` | Student | Spend dashboard data |
| GET | `/api/recommendations` | Student | Personalised menu recommendations |
| POST | `/api/group-orders` | Student | Create a group order |
| GET | `/api/group-orders/:code` | Student | Get group order by share code |
| POST | `/api/group-orders/:code/join` | Student | Join a group order |
| PATCH | `/api/group-orders/:code/checkout` | Student | Confirm & pay for group order |

**Response: GET /api/analytics/spend**
```json
{
  "weekTotal": 4320.00,
  "monthTotal": 18750.00,
  "avgDailySpend": 864.00,
  "preOrderCount": 18,
  "walkInCount": 2,
  "topItems": [
    { "name": "Juice", "count": 8, "totalSpend": 1600.00 },
    { "name": "Fried Rice", "count": 7, "totalSpend": 2450.00 },
    { "name": "Tea", "count": 6, "totalSpend": 600.00 }
  ],
  "weeklyChart": [
    { "date": "2026-07-29", "spend": 850.00 },
    { "date": "2026-07-30", "spend": 920.00 }
  ]
}
```

---

### 5.7 Admin — Dashboard & Orders

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | Admin | Live KPI snapshot |
| GET | `/api/admin/orders` | Admin | Order queue grouped by pickup slot |
| PATCH | `/api/admin/orders/:orderId/status` | Admin | Update order status |
| POST | `/api/admin/orders/:orderId/collect` | Admin | Mark as collected via QR scan |

**Response: GET /api/admin/dashboard**
```json
{
  "date": "2026-08-04",
  "totalOrders": 187,
  "preOrders": 163,
  "walkIns": 24,
  "revenueToday": 84320.00,
  "itemsSold": [
    { "name": "Rice & Curry", "sold": 112, "target": 120 },
    { "name": "Kottu", "sold": 87, "target": 95 }
  ],
  "activeSlotQueue": [
    { "slotTime": "12:30", "pending": 12, "inPrep": 8, "ready": 3 }
  ],
  "hourlyOrders": [
    { "hour": "11:00", "count": 0 },
    { "hour": "12:00", "count": 67 }
  ]
}
```

---

### 5.8 Admin — Cook Plan & Forecast

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/cook-plan` | Admin | Get today's or tomorrow's Cook Plan |
| PATCH | `/api/admin/cook-plan/:itemId` | Admin | Adjust a Cook Plan item quantity |
| POST | `/api/admin/cook-plan/confirm` | Admin | Confirm the full Cook Plan |
| GET | `/api/admin/forecasts/latest` | Admin | Latest ML Demand Forecast |
| POST | `/api/admin/forecasts/trigger` | Admin | Manually trigger a forecast run |

**Response: GET /api/admin/forecasts/latest**
```json
{
  "forecastDate": "2026-08-05",
  "modelVersion": "linear-regression-v1",
  "generatedAt": "2026-08-04T18:02:33Z",
  "items": [
    {
      "menuItemId": "uuid",
      "name": "Rice & Curry",
      "predictedQty": 112,
      "lowEstimate": 98,
      "highEstimate": 126,
      "confidenceScore": 78.4,
      "preOrdersConfirmed": 43
    }
  ]
}
```

---

### 5.9 Admin — Inventory & Procurement

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/inventory` | Admin | Current stock vs. forecasted need |
| POST | `/api/admin/inventory` | Admin | Log today's opening stock levels |
| PATCH | `/api/admin/inventory/:recordId` | Admin | Update closing stock |
| GET | `/api/admin/procurement` | Admin | Active procurement alerts |
| POST | `/api/admin/procurement/purchase-order` | Admin | Generate PDF Purchase Order |
| POST | `/api/admin/discounts/trigger` | Admin | Send Flash Deal push notification |

**Response: GET /api/admin/inventory**
```json
{
  "date": "2026-08-04",
  "ingredients": [
    {
      "id": "uuid",
      "name": "Chicken",
      "unit": "kg",
      "openingStock": 6.0,
      "closingStock": null,
      "forecastedNeed": 18.4,
      "coverage": 0.33,
      "alert": true,
      "deficit": 12.4
    }
  ]
}
```

---

### 5.10 WebSocket Events

**Namespace: `/admin`**

| Event | Direction | Payload | Trigger |
|---|---|---|---|
| `order:new` | Server → Admin | `{ orderId, orderNumber, slotTime, itemCount }` | Student confirms order |
| `order:status_changed` | Server → Admin | `{ orderId, oldStatus, newStatus }` | Admin updates status |
| `sales:update` | Server → Admin | `{ totalOrders, revenue, itemsSold[] }` | Any new order |
| `slot:capacity_changed` | Server → Admin | `{ slotTime, remaining }` | Slot count changes |
| `discount:alert` | Server → Admin | `{ menuItemId, name, soldPct, suggestion }` | 12:30 PM threshold check |

**Namespace: `/student`** (rooms: per `orderId`)

| Event | Direction | Payload | Trigger |
|---|---|---|---|
| `order:ready` | Server → Student | `{ orderId, orderNumber, counter }` | Admin marks Ready |
| `flash:deal` | Server → Student | `{ menuItemId, name, discountPct, expiresAt }` | Admin sends Flash Deal |
| `wallet:topup_confirmed` | Server → Student | `{ amount, newBalance }` | PayHere webhook success |

---

## 6. ML Pipeline Design

### 6.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    FastAPI ML Microservice                       │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────┐ │
│  │  Data Pipeline  │   │  Feature Engineer │   │   Models    │ │
│  │                 │   │                  │   │             │ │
│  │ PostgreSQL ─────►   │ day_of_week      ├──►│ LR Model    │ │
│  │ (via asyncpg)   │   │ pre_order_count  │   │ (per item)  │ │
│  │                 │   │ rolling_7d_avg   │   │             │ │
│  │ Bootstrap CSV ──►   │ rolling_14d_avg  │   │ 8 models    │ │
│  │ (first run)     │   │ is_weekend       │   │ joblib pkl  │ │
│  └─────────────────┘   │ days_since_launch│   │             │ │
│                        └──────────────────┘   └──────┬──────┘ │
│                                                       │         │
│  ┌─────────────────────────────────────────────────── ▼──────┐ │
│  │  Prediction Output → POST to Next.js /api/internal/forecast│ │
│  │  { date, items: [ { menuItemId, predictedQty, low, high,  │ │
│  │                     confidenceScore, modelVersion } ] }    │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Feature Engineering

| Feature | Type | Source | Description |
|---|---|---|---|
| `day_of_week` | int (0–6) | Derived from date | Weekly seasonality (Mon=0, Sun=6) |
| `pre_order_count` | int | `Orders` table (by 9 AM cutoff) | Strongest demand signal |
| `rolling_7d_avg` | float | `OrderItems` aggregation | Short-term trend per item |
| `rolling_14d_avg` | float | `OrderItems` aggregation | Medium-term trend per item |
| `total_pre_orders_today` | int | `Orders` table | Overall campus demand signal |
| `is_weekend` | bool | Derived from date | Weekend demand drop |
| `days_since_launch` | int | Derived | Captures adoption curve growth |
| `dietary_segment_ratio` | float | `Users` table | % of Vegan/Veg/Non-Veg pre-orders |

### 6.3 Model: Linear Regression (v1 Baseline)

```python
# Pseudocode — ml_service/forecaster.py

from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
import joblib

MENU_ITEMS = [
    "Rice & Curry", "Kottu", "Fried Rice",
    "Noodles", "Short Eats", "Juice", "Tea", "Coffee"
]

def build_features(date: str, db_session) -> pd.DataFrame:
    """Construct feature vector for prediction date."""
    dt = pd.to_datetime(date)
    features = {
        "day_of_week": dt.dayofweek,
        "is_weekend": int(dt.dayofweek >= 5),
        "days_since_launch": (dt - LAUNCH_DATE).days,
        "pre_order_count": get_pre_order_count(date, db_session),
        "total_pre_orders": get_total_pre_orders(date, db_session),
        "rolling_7d_avg": get_rolling_avg(date, 7, db_session),
        "rolling_14d_avg": get_rolling_avg(date, 14, db_session),
        "dietary_segment_ratio": get_dietary_ratio(date, db_session),
    }
    return pd.DataFrame([features])

def train_model(item_name: str, db_session):
    """Train per-item Linear Regression model on all available data."""
    df = load_historical_data(item_name, db_session)  # sales + features
    X = df[FEATURE_COLUMNS]
    y = df["actual_qty"]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LinearRegression()
    model.fit(X_scaled, y)

    # Persist model + scaler
    joblib.dump({"model": model, "scaler": scaler},
                f"models/{item_name.replace(' ', '_')}.pkl")
    return model, scaler

def predict(item_name: str, date: str, db_session) -> dict:
    """Generate forecast with confidence interval for one item."""
    artifact = joblib.load(f"models/{item_name.replace(' ', '_')}.pkl")
    model = artifact["model"]
    scaler = artifact["scaler"]

    features = build_features(date, db_session)
    X_scaled = scaler.transform(features)
    prediction = max(0, int(model.predict(X_scaled)[0]))

    # Confidence interval: ±1 std of training residuals
    residual_std = get_training_residual_std(item_name)
    low = max(0, int(prediction - residual_std))
    high = int(prediction + residual_std)

    # Confidence score: R² of the model (0–100)
    confidence = round(model.score(X_scaled_train, y_train) * 100, 1)

    return {
        "menuItemName": item_name,
        "predictedQty": prediction,
        "lowEstimate": low,
        "highEstimate": high,
        "confidenceScore": confidence,
        "modelVersion": "linear-regression-v1"
    }
```

### 6.4 Cook Plan Generation Logic

```
At 18:00 (nightly cron):
  1. Run ML forecast for tomorrow → store in DemandForecasts
  2. Apply 10% buffer:  finalQty = ceil(predictedQty * 1.10)
  3. Store in CookPlanItems with status = SUGGESTED

At 09:05 (post-cutoff cron):
  1. Count confirmed Pre-Orders per menu item
  2. For each CookPlanItem:
     adjustedQty = max(finalQty, preOrderQty * 1.10)
     Update CookPlanItem.preOrderQty + recalculate finalQty
  3. Emit admin:cook_plan_ready WebSocket event

Admin confirms Cook Plan:
  1. CookPlanItem.status → CONFIRMED
  2. CookPlanItem.confirmedAt = NOW()
  3. Lock: edits after 10:00 AM require override flag
```

### 6.5 Wastage Prediction & Smart Discount Logic

```
At 12:30 PM (daily cron):
  For each menu item with a confirmed Cook Plan:
    soldPct = orderItems.soldQty / cookPlanItem.finalQty
    if soldPct < 0.30:
      → Create SmartDiscountTrigger alert
      → Emit admin:/admin discount:alert WebSocket event
      → Admin reviews and optionally sends Flash Deal push

At end of day (18:30 cron):
  For each ingredient:
    wastage = openingStock - (sold_qty * recipe_ratio) - closingStock
    Store in InventoryRecord.wastage
    Update WastageHeatmap cache
```

### 6.6 Recommendation Engine

```python
def get_recommendations(student_id: str, db_session) -> list:
    """
    Collaborative filtering: lightweight item-based approach.
    For MVP: find students with same dept + dietary pref,
    return their most ordered items not yet ordered by this student.
    """
    student = get_student_profile(student_id, db_session)

    # Get peer group (same dept + dietary pref)
    peer_orders = get_peer_orders(
        department=student.department,
        dietary_pref=student.dietaryPreference,
        days=14,
        db_session=db_session
    )

    # Items this student already ordered in last 14 days
    my_items = get_my_recent_items(student_id, days=14, db_session=db_session)

    # Rank peer items by frequency, exclude my items + Sold Out
    ranked = rank_by_frequency(peer_orders, exclude=my_items)
    available = filter_available_today(ranked, db_session)

    return available[:3]
```

---

## 7. Directory Structure

```
canteen_system/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (student)/               # Student route group
│   │   ├── layout.tsx           # Student layout + nav
│   │   ├── home/page.tsx        # Menu + recommendations
│   │   ├── order/page.tsx       # Cart + checkout
│   │   ├── orders/page.tsx      # Order history
│   │   ├── wallet/page.tsx      # Wallet + top-up
│   │   ├── rewards/page.tsx     # Canteen Coins
│   │   ├── analytics/page.tsx   # Spend dashboard
│   │   └── profile/page.tsx     # Profile settings
│   ├── (admin)/                 # Admin route group
│   │   ├── layout.tsx           # Admin layout + nav
│   │   ├── dashboard/page.tsx   # Live sales KPIs
│   │   ├── orders/page.tsx      # Order queue mgmt
│   │   ├── cook-plan/page.tsx   # ML forecast + cook plan
│   │   ├── menu/page.tsx        # Menu management
│   │   ├── inventory/page.tsx   # Stock + procurement
│   │   ├── analytics/page.tsx   # Wastage heatmap + segments
│   │   └── settings/page.tsx    # Slot capacity + config
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── menu/route.ts
│       ├── orders/route.ts
│       ├── wallet/
│       │   ├── route.ts
│       │   ├── topup/route.ts
│       │   └── webhook/route.ts  # PayHere HMAC endpoint
│       ├── coins/route.ts
│       ├── analytics/spend/route.ts
│       ├── recommendations/route.ts
│       ├── group-orders/route.ts
│       └── admin/
│           ├── dashboard/route.ts
│           ├── orders/route.ts
│           ├── cook-plan/route.ts
│           ├── forecasts/route.ts
│           ├── menu/route.ts
│           ├── inventory/route.ts
│           ├── procurement/route.ts
│           ├── discounts/route.ts
│           └── analytics/route.ts
├── components/
│   ├── student/                 # Student-facing components
│   │   ├── MenuCard.tsx
│   │   ├── CartDrawer.tsx
│   │   ├── QRPickupPass.tsx
│   │   ├── OrderStatusBadge.tsx
│   │   ├── CoinsRedemption.tsx
│   │   └── SpendChart.tsx
│   ├── admin/                   # Admin-facing components
│   │   ├── LiveSalesDashboard.tsx  # Client Component (WebSocket)
│   │   ├── OrderQueueCard.tsx
│   │   ├── WastageHeatmap.tsx
│   │   ├── ForecastChart.tsx
│   │   └── CookPlanEditor.tsx
│   └── shared/
│       ├── DietaryBadge.tsx
│       ├── Navbar.tsx
│       └── NotificationToast.tsx
├── lib/
│   ├── auth.ts                  # NextAuth config + domain guard
│   ├── prisma.ts                # Prisma client singleton
│   ├── socket.ts                # Socket.io server instance
│   ├── wallet.ts                # Wallet service (idempotent mutations)
│   ├── coins.ts                 # Coins balance + FIFO redemption
│   ├── payhere.ts               # HMAC validation + checkout URL builder
│   ├── mlClient.ts              # HTTP client for FastAPI ML service
│   └── cron.ts                  # Scheduled jobs (forecast, coins expiry)
├── middleware.ts                # Route protection (RBAC)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── server.ts                    # Custom Next.js server (Socket.io)
├── docs/                        # HackTrail provided datasets
│   ├── sales_logs.csv
│   ├── inventory_records.csv
│   ├── queue_times.csv
│   └── student_demographics.csv
│
└── ml_service/                  # Python FastAPI ML microservice
    ├── main.py                  # FastAPI app + routes
    ├── forecaster.py            # Feature engineering + model training/prediction
    ├── recommender.py           # Collaborative filtering
    ├── data_bootstrap.py        # Seed DB from CSV files (one-time)
    ├── models/                  # Persisted joblib model files
    │   ├── Rice_Curry.pkl
    │   ├── Kottu.pkl
    │   └── ...
    ├── requirements.txt
    └── Dockerfile
```

---

## 8. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Railway.app                                 │
│                                                                        │
│  ┌─────────────────────────────────┐  ┌────────────────────────────┐ │
│  │  Service: next-app              │  │  Service: ml-service        │ │
│  │  Runtime: Node.js 20            │  │  Runtime: Python 3.11       │ │
│  │  Port: 3000                     │  │  Port: 8000                 │ │
│  │  Env: DATABASE_URL              │  │  Env: DATABASE_URL          │ │
│  │       NEXTAUTH_SECRET           │  │       ML_SERVICE_PORT       │ │
│  │       GOOGLE_CLIENT_ID/SECRET   │  │                             │ │
│  │       ML_SERVICE_URL            │  │  Internal URL only          │ │
│  │       PAYHERE_MERCHANT_ID       │  │  (Railway private network)  │ │
│  │       PAYHERE_MERCHANT_SECRET   │  └────────────────────────────┘ │
│  │       CLOUDINARY_URL            │                                  │
│  └─────────────────────────────────┘                                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Service: postgres                                               │ │
│  │  PostgreSQL 16                                                   │ │
│  │  Managed by Railway — private network access only               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                          │
                 Public HTTPS traffic
                          │
                 ┌────────▼────────┐
                 │  Cloudflare CDN │ (optional — static assets)
                 └─────────────────┘
```

**Environment Variables**

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | Both | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Next.js | JWT signing secret |
| `NEXTAUTH_URL` | Next.js | App public URL |
| `GOOGLE_CLIENT_ID` | Next.js | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Next.js | Google OAuth client secret |
| `ML_SERVICE_URL` | Next.js | Internal URL of FastAPI service |
| `PAYHERE_MERCHANT_ID` | Next.js | PayHere merchant ID |
| `PAYHERE_MERCHANT_SECRET` | Next.js | PayHere secret for HMAC |
| `CLOUDINARY_URL` | Next.js | Cloudinary connection string |

---

## 9. Security Design

| Threat | Mitigation |
|---|---|
| Unauthorized role access | Next.js middleware + server-side session check on every Route Handler |
| Non-university email login | NextAuth `signIn` callback rejects emails not matching `@fot.ruh.ac.lk` |
| Wallet double-credit | PayHere idempotency key (`order_id`) + duplicate webhook rejection |
| Wallet balance manipulation | Balance derived from append-only transaction log; no client-submitted balance mutations |
| WebSocket session hijacking | JWT validated in Socket.io handshake middleware; role-based namespace access |
| ML service exposure | Internal network only; no public route or CORS header |
| SQL injection | Prisma ORM parameterises all queries; `$queryRaw` uses tagged template literals |
| XSS | Next.js auto-escapes JSX; Content-Security-Policy header via `next.config.js` |

---

## 10. Key Design Rationale

| Decision | Why |
|---|---|
| **Wallet-first payment (no direct card checkout)** | Pre-paid wallet eliminates no-shows, which corrupt the ML training signal. A student who paid cannot ghost their slot without cost. |
| **Linear Regression as v1 model** | Interpretable, demo-friendly, fast to train. Judges can understand the feature vector. Upgrade path to Random Forest is clean — same FastAPI interface, swapped model file. |
| **8 separate per-item models** | Each menu item has a distinct demand pattern. A single multi-output model would mask item-level seasonality. |
| **Nightly forecast at 18:00, not 09:00** | Gives Admin a Cook Plan before they leave for the day. The 9 AM post-cutoff update then enriches it with confirmed pre-order counts. |
| **Socket.io over Pusher/Ably** | Railway persistent process makes Socket.io native viable. Avoids external paid service dependency for a hackathon demo. |
| **RSC-first rendering** | Data-heavy pages (menu with slot capacities, admin dashboard) render server-side. Only the live WebSocket panels are client components, keeping JS bundle lean. |
| **Prisma over raw SQL** | Type-safe queries, auto-generated types shared with the TypeScript frontend, and migration management — essential for a multi-entity schema of this complexity. |
