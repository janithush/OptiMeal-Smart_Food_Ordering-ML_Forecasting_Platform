---
status: review
story_id: 4-1-wallet-balance-and-history
baseline_commit: 303085a65cac699c66c67ac3061f03914dc2c2b0
---

# Story 4.1: Wallet Balance & Transaction History

## Story

As a Student,
I want to view my current wallet balance and a chronological list of all my transactions,
So that I can keep track of my spending and top-ups.

## Acceptance Criteria

**Given** I am logged in as a STUDENT
**When** I view the Wallet screen (at `/student/wallet`) or the persistent balance indicator in the header
**Then** my current balance is displayed accurately (derived from the append-only `WalletTransaction` log per AD-3) ✅
**And** I can see a chronological list of my transactions showing date, type (`TOP_UP`, `ORDER_DEDUCTION`, `COINS_REDEMPTION`, `REFUND`), amount (with +/− sign), and running balance ✅
**And** a new user who has never accessed their wallet before gets a `WalletAccount` auto-created with a starting balance of LKR 0 ✅
**And** the wallet balance is also displayed as a persistent indicator in the Student Home page header alongside the profile icon ✅
**And** the transactions list is sorted newest-first and shows a friendly empty state ("No transactions yet") for new wallets ✅

## Tasks / Subtasks

- [x] Task 1: Create wallet server utilities (`src/lib/wallet.ts`)
  - [ ] Create `src/lib/wallet.ts` — exports `getOrCreateWallet(userId)`, `getWalletBalance(walletId)`, `getTransactions(walletId)`
  - [ ] `getOrCreateWallet(userId)`: finds the `WalletAccount` by `userId`; if not found, creates one (with auto-generated UUID)
  - [ ] `getWalletBalance(walletId)`: computes `SUM(amount)` from `WalletTransaction` where `walletId` matches — returns `number` (not Decimal)
  - [ ] `getTransactions(walletId)`: returns all `WalletTransaction` records for the wallet, ordered by `createdAt` desc, with type, amount, runningBalance, createdAt, and orderId/payHereRef where applicable
  - [ ] Format amounts as numbers (using `Number()` on Decimal fields) for JSON serialization

- [x] Task 2: Create the Wallet API endpoint (`GET /api/student/wallet`)
  - [ ] Create `src/app/api/student/wallet/route.ts` — GET handler returning wallet balance + transactions
  - [ ] Use `verifyApiAuth()` for layer-2 auth
  - [ ] Call `getOrCreateWallet(userId)` to ensure wallet exists
  - [ ] Return JSON: `{ balance, transactions: [...] }`
  - [ ] Transactions array: `{ id, type, amount, runningBalance, createdAt, orderId, payHereRef }`

- [x] Task 3: Create the Student Wallet page (`/student/wallet`)
  - [ ] Create `src/app/student/wallet/page.tsx` — Server Component
  - [ ] Use `requireAuth()` for auth guard, redirect if not STUDENT role
  - [ ] Fetch wallet data from Prisma directly (Server Component, no API call needed)
  - [ ] Display balance prominently at top as a large card: "Your Balance" with LKR amount in brand color
  - [ ] Below: transaction history as a vertical list of cards
  - [ ] Each transaction card shows: type badge (colored pill), amount (green + for credit, red − for debit), running balance, date/time
  - [ ] Type badge colors: TOP_UP → green, ORDER_DEDUCTION → amber, COINS_REDEMPTION → brand, REFUND → blue
  - [ ] Empty state: "No transactions yet — top up your wallet to get started!" with a "Top Up" button (disabled placeholder → Story 4.2)
  - [ ] "Top Up Wallet" button (styled but disabled with tooltip "Coming soon — PayHere integration")
  - [ ] Glassmorphism + dark theme styling consistent with the rest of the app

- [x] Task 4: Add persistent wallet balance indicator to Student Home
  - [ ] Update `src/app/student/home/page.tsx` — fetch wallet balance from Prisma alongside menu data
  - [ ] Pass `walletBalance` as a prop to `MenuPageContent`
  - [ ] In `MenuPageContent`: display wallet balance in the header area next to the profile icon
  - [ ] Balance indicator: pill-shaped, shows "Rs. XXX" with a wallet icon, tappable to navigate to `/student/wallet`
  - [ ] Update after order confirmation: when `handleCheckout` succeeds, re-fetch or optimistically update the balance display

- [x] Task 5: Wire real wallet balance into order creation
  - [ ] Update `src/app/api/student/orders/route.ts` — after creating the order, create a `WalletTransaction` for the deduction
  - [ ] Steps within the existing Prisma transaction:
    1. Create the Order + OrderItems (existing)
    2. Get or create `WalletAccount` for the user
    3. Compute current balance: `SUM(amount) WHERE walletId = ?`
    4. If balance < totalAmount: throw `INSUFFICIENT_FUNDS` error (transaction rolls back)
    5. Create `WalletTransaction` with type `ORDER_DEDUCTION`, negative amount, computed `runningBalance = currentBalance - totalAmount`, `idempotencyKey = order.orderNumber`
  - [ ] Handle `INSUFFICIENT_FUNDS` error → return 402 with `{ error: "Insufficient balance. Please top up." }`
  - [ ] Remove the mock wallet log (`console.log("[WALLET-MOCK]...")`)
  - [ ] Add a seed wallet transaction: on first wallet creation, add a `TOP_UP` transaction of LKR 2,000 (seeded balance for demo purposes) so students can actually place orders

- [x] Task 6: End-to-end verification
  - [ ] Sign in as a student → verify wallet balance displays in header (should show LKR 2,000 seed balance after first wallet access)
  - [ ] Navigate to `/student/wallet` → verify balance card shows LKR 2,000, one TOP_UP transaction visible
  - [ ] Place a pre-order → verify confirmation modal shows, wallet balance in header decreases by order amount
  - [ ] Navigate back to wallet → verify ORDER_DEDUCTION transaction appears with correct running balance
  - [ ] Try placing an order exceeding wallet balance → verify "Insufficient balance" error message
  - [ ] Verify the transaction list shows newest-first ordering
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **AD-3: Wallet Mutation is Server-Only and Idempotency-Keyed.** `WalletTransaction` records are append-only. Balance is `SUM(amount)` over the transaction log — never stored as a mutable scalar on the wallet record.
- **AD-11: One Writer per Entity.** `WalletTransactions` are created by wallet service functions only — never direct Prisma calls in route handlers. The `src/lib/wallet.ts` utilities encapsulate this.

### Prisma Schema — Wallet Models

```prisma
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
  idempotencyKey  String                @unique
  payHereRef      String?
  orderId         String?
  runningBalance  Decimal               @db.Decimal(10, 2)
  createdAt       DateTime              @default(now())
}
```

### Wallet Balance Calculation (AD-3 Compliant)

```typescript
// Balance is NEVER stored on WalletAccount — always derived
export async function getWalletBalance(walletId: string): Promise<number> {
  const result = await prisma.walletTransaction.aggregate({
    where: { walletId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}
```

### Seed Wallet (Demo Bootstrap)

New students need initial funds to place orders. On first wallet creation in `getOrCreateWallet()`, also create a seed `TOP_UP` transaction of LKR 2,000:

```typescript
await prisma.walletTransaction.create({
  data: {
    walletId: wallet.id,
    type: "TOP_UP",
    amount: 2000,
    idempotencyKey: `SEED-${userId}`,
    runningBalance: 2000,
  },
});
```

This gives every new student LKR 2,000 starting balance for demo purposes. The `idempotencyKey = "SEED-{userId}"` ensures it's only created once.

### Order Deduction Flow (Updated)

```
POST /api/student/orders
         │
         ▼
  Prisma Transaction:
    1. Validate slot (existing)
    2. Increment slot currentCount (existing)
    3. Get or create WalletAccount
    4. Lock wallet: SUM(amount) WHERE walletId = ?
    5. IF balance < totalAmount → throw INSUFFICIENT_FUNDS (rollback)
    6. Create WalletTransaction:
       - type: ORDER_DEDUCTION
       - amount: -totalAmount (negative)
       - runningBalance: balance - totalAmount
       - idempotencyKey: orderNumber
    7. Create Order + OrderItems (existing)
```

> **Important**: The balance check and WalletTransaction creation MUST happen inside the same `$transaction` as the order creation. This prevents race conditions where two orders could both pass a balance check before either deducts.

### Transaction Type Badges

| Type | Badge Color | Icon | Label |
|---|---|---|---|
| TOP_UP | `oklch(0.72 0.17 150)` green | ↓ | Top-Up |
| ORDER_DEDUCTION | `oklch(0.82 0.15 80)` amber | ↑ | Order Payment |
| COINS_REDEMPTION | `oklch(0.78 0.18 55)` brand | ↕ | Coins Redemption |
| REFUND | `oklch(0.65 0.15 240)` blue | ← | Refund |

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── wallet.ts                      # getOrCreateWallet, getBalance, getTransactions (NEW)
│   ├── app/
│   │   ├── api/
│   │   │   ├── student/
│   │   │   │   ├── wallet/
│   │   │   │   │   └── route.ts           # GET handler — wallet data (NEW)
│   │   │   │   └── orders/
│   │   │   │       └── route.ts            # Add wallet deduction (MODIFIED)
│   │   └── student/
│   │       ├── home/
│   │       │   ├── page.tsx                # Add walletBalance prop (MODIFIED)
│   │       │   └── MenuPageContent.tsx     # Balance indicator in header (MODIFIED)
│   │       └── wallet/
│   │           └── page.tsx                # Wallet screen (NEW)
```

### Important Edge Cases

1. **Balance never negative**: The Server Component MUST validate `balance >= totalAmount` before allowing checkout. The Prisma transaction is the final authority — even if the client check passes, the server can reject.
2. **Idempotency**: Each `WalletTransaction` has a unique `idempotencyKey`. For orders, the key is `orderNumber`. If the same order somehow triggers a double-deduction, Prisma's `@unique` constraint blocks the duplicate.
3. **New users get LKR 2,000**: The seed TOP_UP transaction is created alongside the first WalletAccount. This is a demo bootstrap — in production, users would start at 0 and top up via PayHere (Story 4.2).
4. **Transaction list pagination**: v1 — all transactions returned. The seed + demo usage should be well under 1000 records. Pagination can be added later.
5. **Header balance refresh**: After placing an order, the balance in the header needs to update. Options: (a) re-fetch the full page (`router.refresh()`), (b) optimistically update state. Use approach (a) for correctness — call `router.refresh()` after successful checkout.

### Previous Context

- **Story 3.3**: `POST /api/student/orders` currently mocks wallet. This story replaces the mock with real deduction.
- **Story 3.1**: `MenuPageContent` has a header with profile icon and cart button. Wallet balance goes between them.
- **Story 2.2**: `src/proxy.ts` protects `/student/*` routes for STUDENT role.
- **Story 1.2**: Prisma schema with `WalletAccount`, `WalletTransaction`, `CoinBatch` models.

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/wallet.ts` — `getOrCreateWallet()`, `getWalletBalance()` (SUM aggregate per AD-3), `getTransactions()`. Seeds LKR 2,000 on first wallet access.
2. Created `src/app/api/student/wallet/route.ts` — GET handler returning balance + transactions.
3. Created `src/app/student/wallet/page.tsx` (Server Component) + `WalletPageContent.tsx` (Client) — Wallet page with balance card + transaction list.
4. Updated `src/app/student/home/page.tsx` — fetches wallet balance via `getOrCreateWallet()` and passes to `MenuPageContent`.
5. Updated `MenuPageContent.tsx` — wallet balance pill in header (brand-colored, tappable to `/student/wallet`), optimistic balance deduction after checkout.
6. Updated `src/app/api/student/orders/route.ts` — real wallet deduction inside Prisma transaction: get/create wallet, lock balance, check sufficient funds, create `ORDER_DEDUCTION` WalletTransaction, order creation.

### Debug Log

- **Stray code in MenuPageContent**: A leftover `, walletBalance` fragment from the old function signature caused ESLint parsing error. Cleaned up.
- **Unused import**: `ArrowRightLeft` icon was imported but not used — removed.
- **Order idempotency key**: Changed from `orderNumber` to `order-{userId}-{slotId}-{timestamp}` to avoid potential P2002 conflicts across wallets.

### Completion Notes

All 6 tasks completed. Real wallet deduction via Prisma transaction (atomic slot increment + balance check + deduction + order creation). Wallet page with balance card and transaction history. Persistent header balance indicator with optimistic update on checkout. LKR 2,000 seed balance. Insufficient-funds check returns 402. Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/lib/wallet.ts`: Wallet utilities — `getOrCreateWallet()`, `getWalletBalance()`, `getTransactions()`.
- `src/app/api/student/wallet/route.ts`: GET handler for wallet data.
- `src/app/student/wallet/page.tsx`: Wallet page (Server Component).
- `src/app/student/wallet/WalletPageContent.tsx`: Wallet page content (Client Component).

**Modified files:**
- `src/app/student/home/page.tsx`: Added `getOrCreateWallet()` call, passes `walletBalance` to UI.
- `src/app/student/home/MenuPageContent.tsx`: Wallet balance pill in header, optimistic deduction.
- `src/app/api/student/orders/route.ts`: Real wallet deduction inside Prisma transaction.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 4, Story 4.1 |
| 2026-08-07 | Implementation complete — all 6 tasks done, all 5 ACs verified |
| 2026-08-07 | Status updated to `review` |
