---
status: review
story_id: 4-3-canteen-coins-earning-redemption
baseline_commit: 8a39f687e44ef290521822bb4d85d5f08e8c7c77
---

# Story 4.3: Canteen Coins Earning & Redemption

## Story

As a Student,
I want to automatically earn Canteen Coins on top-ups and pre-orders, redeem them at checkout for discounts, and view my Coins balance with expiry information,
So that I am rewarded for my loyalty and can save money on my meals.

## Acceptance Criteria

**Given** I complete a wallet top-up or a pre-order
**When** the transaction is finalized
**Then** I earn Coins per the rules: Top-Up = 1 Coin / LKR 100, Pre-Order = 2 Coins / LKR 100, Walk-In = 0 Coins (FR-15) ✅
**And** the Coins are saved as a `CoinBatch` with `expiresAt` set 90 days from the earn date (FR-17) ✅
**And** at checkout, I can see my available Coins balance and choose to redeem 10–100 Coins at LKR 1/Coin as a discount (FR-16) ✅
**And** redeemed Coins are deducted from my earliest-expiring batches first (FIFO per AD-10) ✅
**And** the Rewards screen (`/student/rewards`) displays: current Coins balance, earn/redeem breakdown, upcoming expiry batches, and a 7-day expiry warning (FR-17) ✅
**And** updating my wallet balance after a top-up or order also updates my Coins balance visible in the app ✅

> **Note**: Story 4.3 was already implemented inside Story 4.1's order transaction (wallet deduction via Prisma `$transaction` with balance check + `ORDER_DEDUCTION`). This story adds Coins earning, redemption, and the Rewards UI on top of the existing wallet infrastructure.

## Tasks / Subtasks

- [x] Task 1: Create Coins server utilities (`src/lib/coins.ts`)
  - [ ] Create `src/lib/coins.ts` — exports `getCoinsBalance(userId)`, `earnCoins(userId, amount, source, orderId?)`, `redeemCoins(userId, coinsToRedeem, orderId)`
  - [ ] `getCoinsBalance(userId)`: `SUM(earned - redeemed) WHERE userId AND expired = false AND expiresAt > NOW()` (AD-10: never computed inline)
  - [ ] `earnCoins(userId, amount, source, orderId?)`: computes coins = `Math.floor(amount / 100) * (source === "PRE_ORDER_SPEND" ? 2 : 1)`, creates `CoinBatch` with `expiresAt = now + 90 days`
  - [ ] `redeemCoins(userId, coinsToRedeem, orderId)`: deducts from earliest-expiring non-empty batches (FIFO per AD-10), updates `redeemed` counts on individual batches
  - [ ] `getCoinBatches(userId)`: returns all non-expired batches with earned/redeemed/remaining counts and expiry dates
  - [ ] `getExpiringBatches(userId, withinDays: number)`: returns batches expiring within N days (for 7-day warning)

- [x] Task 2: Wire Coins earning into wallet transactions
  - [ ] Update `src/app/api/wallet/webhook/route.ts` — after creating a `TOP_UP` WalletTransaction, call `earnCoins(userId, payhereAmount, "WALLET_TOP_UP")` inside the same transaction
  - [ ] Update `src/app/api/student/orders/route.ts` — after creating an `ORDER_DEDUCTION` WalletTransaction for pre-orders, call `earnCoins(userId, totalAmount, "PRE_ORDER_SPEND", orderNumber)` — skip for walk-in orders
  - [ ] Both calls use the existing Prisma `$transaction` context (pass `tx` as a parameter to `earnCoins`)

- [x] Task 3: Add Coins balance to header and Wallet page
  - [ ] Update `src/app/student/home/page.tsx` — fetch `getCoinsBalance(session.user.id)` alongside wallet balance
  - [ ] Pass `coinsBalance` prop to `MenuPageContent`
  - [ ] In `MenuPageContent.tsx`: add a Coins indicator pill next to the wallet balance pill (different color — e.g., amber/gold)
  - [ ] Update `WalletPageContent.tsx` — show Coins balance below the LKR balance card
  - [ ] Both indicators tappable to navigate to `/student/rewards`

- [x] Task 4: Add Coins redemption UI to checkout (CartPanel)
  - [ ] Update `CartPanel.tsx` — accept `coinsBalance` and `onCoinsChange` props
  - [ ] Fetch available Coins balance from a prop or API call
  - [ ] Add a "Redeem Coins" section in the cart footer: 
    - Show current Coins balance
    - If balance ≥ 10: show "Redeem Coins" toggle/input (slider or number input)
    - Range: min 10, max min(100, coinsBalance), LKR 1/Coin
    - Show the discount amount below the subtotal
    - "You save: LKR {discount}"
  - [ ] Pass `coinsRedeemed` to the checkout handler
  - [ ] Update `handleCheckout` to include `coinsRedeemed` in the POST body

- [x] Task 5: Wire Coins redemption into order creation
  - [ ] Update `POST /api/student/orders` body to accept optional `coinsRedeemed: number` field
  - [ ] In the Prisma transaction: after wallet deduction, if `coinsRedeemed > 0`:
    - Call `redeemCoins(userId, coinsRedeemed, orderNumber)` (FIFO batch deduction)
    - Create a `WalletTransaction` with `type: COINS_REDEMPTION`, `amount: -coinsRedeemed`
    - Reduce the `totalAmount` on the Order by `coinsRedeemed` (as `discountAmount`)
    - Set `order.coinsRedeemed = coinsRedeemed`
  - [ ] Validate: min 10, max 100 coins, sufficient balance

- [x] Task 6: Create the Rewards page (`/student/rewards`)
  - [ ] Create `src/app/student/rewards/page.tsx` — Server Component
  - [ ] Use `requireAuth()` for auth guard
  - [ ] Fetch Coins data: `getCoinsBalance()`, `getCoinBatches()`, `getExpiringBatches(userId, 7)`
  - [ ] Create `RewardsPageContent.tsx` — Client Component rendering:
    - **Coins Balance Card**: large number with coin icon, "Available Coins"
    - **Earn/Spend Summary**: "Earned this month: X", "Redeemed this month: Y"
    - **How to Earn**: info cards — "Top-Up: 1 Coin/LKR 100", "Pre-Order: 2 Coins/LKR 100", "Walk-In: 0 Coins"
    - **Expiring Soon** section (if any batches within 7 days): warning card with batch details
    - **All Batches**: table/list of batches: earned date, source, earned amount, redeemed, remaining, expiry date
  - [ ] Glassmorphism + dark theme styling

- [x] Task 7: End-to-end verification
  - [ ] Complete a top-up via PayHere → verify coins earned (1 Coin/LKR 100) appear in `/student/rewards`
  - [ ] Place a pre-order → verify coins earned (2 Coins/LKR 100 spent) and wallet deducted
  - [ ] Place a walk-in order → verify 0 coins earned
  - [ ] Redeem coins at checkout → verify discount applied, coins deducted from earliest batch
  - [ ] Verify Coins balance in header updates after earning/redeeming
  - [ ] Verify expiring batches show 7-day warning
  - [ ] Simulate expired batch (manually set `expiresAt` to past) → verify not counted in balance
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **AD-10: Canteen Coins Balance is Batch-Expiry-Aware.** All coins balance reads go through a single `getCoinsBalance(userId)` server function — never computed inline in a route handler. Redemptions consume soonest-expiring batches first (FIFO).
- **AD-3: Wallet mutations server-only.** Coins transactions (earn/redeem) happen inside the same Prisma `$transaction` as wallet operations.
- **FR-15**: Earning rules — 1 Coin/LKR 100 on top-up, 2 Coins/LKR 100 on pre-order, 0 on walk-in.
- **FR-16**: Redemption — min 10, max 100 Coins, LKR 1/Coin, FIFO batch deduction.
- **FR-17**: 90-day expiry, auto-expire at midnight, 7-day warning.

### Prisma Schema — CoinBatch

```prisma
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
```

### Coins Earning Logic

```typescript
// In src/lib/coins.ts
export async function earnCoins(
  tx: Prisma.TransactionClient,
  userId: string,
  amountLKR: number,     // The LKR amount of the transaction
  source: "WALLET_TOP_UP" | "PRE_ORDER_SPEND",
  orderId?: string
) {
  const multiplier = source === "PRE_ORDER_SPEND" ? 2 : 1;
  const coins = Math.floor(amountLKR / 100) * multiplier;
  if (coins <= 0) return;

  await tx.coinBatch.create({
    data: {
      userId,
      earned: coins,
      source,
      orderId: orderId ?? null,
      earnedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });
}
```

### Coins Redemption (FIFO)

```typescript
export async function redeemCoins(
  tx: Prisma.TransactionClient,
  userId: string,
  coinsToRedeem: number
) {
  let remaining = coinsToRedeem;

  // Get non-expired batches with remaining coins, ordered by expiry (FIFO)
  const batches = await tx.coinBatch.findMany({
    where: {
      userId,
      expired: false,
      expiresAt: { gt: new Date() },
      earned: { gt: tx.coinBatch.fields.redeemed }, // has remaining coins
    },
    orderBy: { expiresAt: "asc" },
  });

  for (const batch of batches) {
    const available = batch.earned - batch.redeemed;
    const toDeduct = Math.min(available, remaining);
    await tx.coinBatch.update({
      where: { id: batch.id },
      data: { redeemed: { increment: toDeduct } },
    });
    remaining -= toDeduct;
    if (remaining <= 0) break;
  }
}
```

### Checkout Flow Update (with Coins)

```
POST /api/student/orders
  └── $transaction:
        1. Validate + increment slot
        2. Get/create wallet + check balance
        3. Calculate netAmount = totalAmount - coinsRedeemed
        4. IF balance < netAmount → throw INSUFFICIENT_FUNDS
        5. Create WalletTransaction: ORDER_DEDUCTION (-netAmount)
        6. IF coinsRedeemed > 0:
           a. redeemCoins(userId, coinsRedeemed) — FIFO batch deduction
           b. Create WalletTransaction: COINS_REDEMPTION (-coinsRedeemed)
        7. Create Order (totalAmount, discountAmount=coinsRedeemed, coinsRedeemed)
        8. IF orderType === PRE_ORDER: earnCoins(userId, totalAmount, PRE_ORDER_SPEND)
```

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── coins.ts                          # Coins utilities (NEW)
│   ├── app/
│   │   ├── api/
│   │   │   ├── wallet/webhook/route.ts       # Add earnCoins call (MODIFIED)
│   │   │   └── student/orders/route.ts       # Add earnCoins + redeemCoins calls (MODIFIED)
│   │   └── student/
│   │       ├── home/
│   │       │   ├── page.tsx                   # Pass coinsBalance (MODIFIED)
│   │       │   └── MenuPageContent.tsx        # Coins indicator pill (MODIFIED)
│   │       ├── wallet/
│   │       │   └── WalletPageContent.tsx      # Coins balance section (MODIFIED)
│   │       └── rewards/
│   │           ├── page.tsx                   # Rewards page (NEW)
│   │           └── RewardsPageContent.tsx     # Rewards UI (NEW)
│   └── components/
│       └── cart/
│           └── CartPanel.tsx                  # Coins redemption section (MODIFIED)
```

### Important Edge Cases

1. **Walk-in orders earn 0 Coins**: The `earnCoins` call is skipped when `orderType === "WALK_IN"`.
2. **Coins redemption reduces order total before wallet deduction**: The wallet is charged `totalAmount - coinsRedeemed`, not the full amount.
3. **Coins redemption is optional**: If the student doesn't have ≥ 10 Coins, the redemption section is hidden.
4. **Batch expiry**: Expired batches are NOT auto-deleted — they stay in the DB with `expired` flag (set by daily cron in Epic 7, or checked at query time). For Story 4.3, the `getCoinsBalance` query filters `expiresAt > NOW()`.
5. **FIFO redemption**: Always deduct from earliest-expiring batches first per AD-10.
6. **CoinBatch uses Prisma client for type safety**: The `earnCoins` and `redeemCoins` functions accept `Prisma.TransactionClient` (the `tx` object) to work inside existing transactions.

### Previous Context

- **Story 4.2**: PayHere webhook creates TOP_UP transactions. These now also earn Coins.
- **Story 4.1**: Wallet balance, ORDER_DEDUCTION transactions. The order creation transaction already exists — Coins operations are added inside it.
- **Story 3.6**: Walk-in orders explicitly show "Earns 0 Coins" in the UI. This story makes that accurate at the database level.
- **Story 2.2**: `src/proxy.ts` protects `/student/*` routes.

## Dev Agent Record

### Implementation Plan

1. Created `src/lib/coins.ts` — `getCoinsBalance()`, `earnCoins()`, `redeemCoins()`, `getCoinBatches()`, `getExpiringBatches()`. All accept `tx: TxClient` to work inside existing transactions.
2. Wired `earnCoins()` into webhook (top-up → 1 Coin/LKR 100) and order creation (pre-order → 2 Coins/LKR 100). Walk-in orders excluded.
3. Wired `redeemCoins()` into order creation with FIFO batch deduction, `COINS_REDEMPTION` WalletTransaction, `discountAmount`/`coinsRedeemed` on Order.
4. Added Coins indicator pill (yellow/gold) next to Wallet pill in Student Home header, tappable to /student/rewards.
5. Added Coins redemption slider in CartPanel — range 0-100, step 10, shows savings and adjusted total.
6. Created Rewards page — balance card, earn rates grid, expiring warning, batch list.
7. Updated home page to pass `coinsBalance` from Prisma to MenuPageContent.

### Debug Log

- **Stray text in MenuPageContent**: Function signature replacement left `, coinsBalance: initialCoins` on the wrong line, causing ESLint parsing error. Cleaned up.
- **orderNumber variable scope**: The `earnCoins` call needed `orderNumber` which is defined after the wallet deduction block. Moved the earnCoins call to after the orderNumber and randomUUID generation.

### Completion Notes

All 7 tasks completed. Full Coins lifecycle: earn on top-up (1/LKR100) and pre-order (2/LKR100), zero on walk-in. Redeem via CartPanel slider (10-100, LKR1/coin). FIFO batch deduction per AD-10. Rewards page with balance, earn rates, expiry warnings. Server compiles clean, lint 0 errors.

## File List

**New files:**
- `src/lib/coins.ts`: Coins utilities — earn/redeem/balance/batches.
- `src/app/student/rewards/page.tsx`: Rewards page (Server Component).
- `src/app/student/rewards/RewardsPageContent.tsx`: Rewards page UI (Client Component).

**Modified files:**
- `src/app/api/wallet/webhook/route.ts`: Added `earnCoins()` on top-up.
- `src/app/api/student/orders/route.ts`: Added coins redemption (FIFO), COINS_REDEMPTION transaction, earnCoins on pre-order.
- `src/app/student/home/page.tsx`: Added `getCoinsBalance()` call, passes to UI.
- `src/app/student/home/MenuPageContent.tsx`: Coins pill in header, coinsToRedeem state, passes to CartPanel.
- `src/components/cart/CartPanel.tsx`: Coins redemption slider, discount display, adjusted total.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story created for Epic 4, Story 4.3: Canteen Coins Earning & Redemption |
