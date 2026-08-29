-- ─────────────────────────────────────────────────────────────────────────────
-- CaféSmart baseline migration (0_init)
--
-- This file is the canonical, version-controlled database schema for the
-- CaféSmart Smart University Canteen System. It mirrors `prisma/schema.prisma`
-- and is intended to be used with `prisma migrate deploy` in CI / production.
--
-- Local development can still use `prisma db push` for quick iteration, but
-- production deploys MUST go through `prisma migrate deploy` so the schema
-- history is reproducible.
--
-- Generated: 2026-08-29
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
CREATE TYPE "Role"                  AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE "Department"            AS ENUM ('ICT', 'ET', 'BST');
CREATE TYPE "DietaryPreference"     AS ENUM ('VEGAN', 'VEGETARIAN', 'NON_VEGETARIAN');
CREATE TYPE "OrderType"             AS ENUM ('PRE_ORDER', 'WALK_IN');
CREATE TYPE "OrderStatus"           AS ENUM ('CONFIRMED', 'IN_PREPARATION', 'READY', 'COLLECTED', 'CANCELLED');
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'ORDER_DEDUCTION', 'COINS_REDEMPTION', 'REFUND');
CREATE TYPE "CookPlanStatus"        AS ENUM ('SUGGESTED', 'CONFIRMED', 'SUPERSEDED');
CREATE TYPE "GroupOrderStatus"      AS ENUM ('OPEN', 'CONFIRMED', 'EXPIRED');
CREATE TYPE "CoinSource"            AS ENUM ('WALLET_TOP_UP', 'PRE_ORDER_SPEND');
-- ─── Core User ────────────────────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"                  TEXT PRIMARY KEY,
    "email"               TEXT NOT NULL UNIQUE,
    "emailVerified"       TIMESTAMP(3),
    "name"                TEXT NOT NULL,
    "image"               TEXT,
    "role"                "Role" NOT NULL DEFAULT 'STUDENT',
    "regNo"               TEXT UNIQUE,
    "batch"               TEXT,
    "department"          "Department",
    "dietaryPreference"   "DietaryPreference",
    "allergies"           TEXT[],
    "phone"               TEXT,
    "onboardingDone"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL
);

-- ─── NextAuth (Auth.js) models ───────────────────────────────────────────────
CREATE TABLE "Account" (
    "id"                  TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "type"                TEXT NOT NULL,
    "provider"            TEXT NOT NULL,
    "providerAccountId"   TEXT NOT NULL,
    "refresh_token"       TEXT,
    "access_token"        TEXT,
    "expires_at"          INTEGER,
    "token_type"          TEXT,
    "scope"               TEXT,
    "id_token"            TEXT,
    "session_state"       TEXT,
    UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL UNIQUE,
    "expires"    TIMESTAMP(3) NOT NULL,
    UNIQUE ("identifier", "token")
);

-- ─── Wallet ──────────────────────────────────────────────────────────────────
CREATE TABLE "WalletAccount" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT NOT NULL UNIQUE REFERENCES "User"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WalletAccount_userId_idx" ON "WalletAccount"("userId");

CREATE TABLE "WalletTransaction" (
    "id"              TEXT PRIMARY KEY,
    "walletId"        TEXT NOT NULL REFERENCES "WalletAccount"("id"),
    "type"            "WalletTransactionType" NOT NULL,
    "amount"          DECIMAL(10,2) NOT NULL,
    "idempotencyKey"  TEXT NOT NULL UNIQUE,
    "payHereRef"      TEXT,
    "orderId"         TEXT,
    "runningBalance"  DECIMAL(10,2) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Loyalty Coins ──────────────────────────────────────────────────────────
CREATE TABLE "CoinBatch" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT NOT NULL REFERENCES "User"("id"),
    "earned"    INTEGER NOT NULL,
    "redeemed"  INTEGER NOT NULL DEFAULT 0,
    "source"    "CoinSource" NOT NULL,
    "orderId"   TEXT,
    "earnedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "expired"   BOOLEAN NOT NULL DEFAULT false
);

-- ─── Menu ────────────────────────────────────────────────────────────────────
CREATE TABLE "MenuItem" (
    "id"          TEXT PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "basePrice"   DECIMAL(8,2) NOT NULL,
    "dietaryType" "DietaryPreference" NOT NULL,
    "imageUrl"    TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL
);

CREATE TABLE "MenuItemIngredient" (
    "menuItemId"         TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "ingredientId"       TEXT NOT NULL REFERENCES "Ingredient"("id"),
    "quantityPerPortion" DECIMAL(8,4) NOT NULL,
    PRIMARY KEY ("menuItemId","ingredientId")
);

CREATE TABLE "DailySpecial" (
    "id"           TEXT PRIMARY KEY,
    "menuItemId"   TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "specialPrice" DECIMAL(8,2) NOT NULL,
    "description"  TEXT,
    "date"         DATE NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("menuItemId","date")
);

-- ─── Pickup Slots ───────────────────────────────────────────────────────────
CREATE TABLE "PickupSlot" (
    "id"           TEXT PRIMARY KEY,
    "date"         DATE NOT NULL,
    "slotTime"     TEXT NOT NULL,
    "maxCapacity"  INTEGER NOT NULL DEFAULT 30,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    UNIQUE ("date","slotTime")
);

-- ─── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE "Order" (
    "id"             TEXT PRIMARY KEY,
    "orderNumber"    TEXT NOT NULL UNIQUE,
    "studentId"      TEXT NOT NULL REFERENCES "User"("id"),
    "type"           "OrderType" NOT NULL,
    "status"         "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "pickupSlotId"   TEXT REFERENCES "PickupSlot"("id"),
    "totalAmount"    DECIMAL(10,2) NOT NULL,
    "coinsRedeemed"  INTEGER NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "discountType"   "DiscountType" NOT NULL DEFAULT 'NONE',
    "flashDealId"    TEXT REFERENCES "FlashDeal"("id"),
    "qrCode"         TEXT NOT NULL UNIQUE,
    "groupOrderId"   TEXT REFERENCES "GroupOrder"("id"),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Order_status_idx"         ON "Order"("status");
CREATE INDEX "Order_createdAt_idx"      ON "Order"("createdAt");
CREATE INDEX "Order_studentId_idx"      ON "Order"("studentId");
CREATE INDEX "Order_type_createdAt_idx" ON "Order"("type","createdAt");

CREATE TABLE "OrderItem" (
    "id"         TEXT PRIMARY KEY,
    "orderId"    TEXT NOT NULL REFERENCES "Order"("id"),
    "menuItemId" TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "quantity"   INTEGER NOT NULL,
    "unitPrice"  DECIMAL(8,2) NOT NULL,
    "subtotal"   DECIMAL(10,2) NOT NULL
);
CREATE INDEX "OrderItem_orderId_idx"    ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- ─── Group Orders ───────────────────────────────────────────────────────────
CREATE TABLE "GroupOrder" (
    "id"           TEXT PRIMARY KEY,
    "code"         CHAR(6) NOT NULL UNIQUE,
    "organizerId"  TEXT NOT NULL REFERENCES "User"("id"),
    "pickupSlotId" TEXT,
    "status"       "GroupOrderStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GroupOrderParticipant" (
    "id"           TEXT PRIMARY KEY,
    "groupOrderId" TEXT NOT NULL REFERENCES "GroupOrder"("id") ON DELETE CASCADE,
    "studentId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("groupOrderId","studentId")
);
CREATE INDEX "GroupOrderParticipant_studentId_idx" ON "GroupOrderParticipant"("studentId");

CREATE TABLE "GroupOrderCartItem" (
    "id"            TEXT PRIMARY KEY,
    "groupOrderId"  TEXT NOT NULL REFERENCES "GroupOrder"("id") ON DELETE CASCADE,
    "participantId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "menuItemId"    TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "quantity"      INTEGER NOT NULL,
    "addedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("groupOrderId","participantId","menuItemId")
);
CREATE INDEX "GroupOrderCartItem_participantId_idx" ON "GroupOrderCartItem"("participantId");

-- ─── Inventory ──────────────────────────────────────────────────────────────
CREATE TABLE "Ingredient" (
    "id"        TEXT PRIMARY KEY,
    "name"      TEXT NOT NULL UNIQUE,
    "unit"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "InventoryRecord" (
    "id"            TEXT PRIMARY KEY,
    "ingredientId"  TEXT NOT NULL REFERENCES "Ingredient"("id"),
    "date"          DATE NOT NULL,
    "openingStock"  DECIMAL(8,3) NOT NULL,
    "receivedStock" DECIMAL(8,3),
    "consumedStock" DECIMAL(8,3),
    "closingStock"  DECIMAL(8,3),
    "wastage"       DECIMAL(8,3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("ingredientId","date")
);
CREATE INDEX "InventoryRecord_date_idx" ON "InventoryRecord"("date");

-- ─── Flash Deals ────────────────────────────────────────────────────────────
CREATE TABLE "FlashDeal" (
    "id"               TEXT PRIMARY KEY,
    "menuItemId"       TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "discountPercent"  INTEGER NOT NULL,
    "cookPlanTarget"   INTEGER NOT NULL,
    "unitsSoldAtStart" INTEGER NOT NULL,
    "message"          TEXT,
    "expiresAt"        TIMESTAMP(3) NOT NULL,
    "cancelledAt"      TIMESTAMP(3),
    "createdBy"        TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── ML & Forecasting ───────────────────────────────────────────────────────
CREATE TABLE "DemandForecast" (
    "id"              TEXT PRIMARY KEY,
    "date"            DATE NOT NULL,
    "menuItemId"      TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "predictedQty"    INTEGER NOT NULL,
    "lowEstimate"     INTEGER NOT NULL,
    "highEstimate"    INTEGER NOT NULL,
    "confidenceScore" DECIMAL(5,2) NOT NULL,
    "modelVersion"    TEXT NOT NULL,
    "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("date","menuItemId")
);
CREATE INDEX "DemandForecast_date_idx" ON "DemandForecast"("date");

CREATE TABLE "CookPlanItem" (
    "id"             TEXT PRIMARY KEY,
    "date"           DATE NOT NULL,
    "menuItemId"     TEXT NOT NULL REFERENCES "MenuItem"("id"),
    "forecastQty"    INTEGER NOT NULL,
    "preOrderQty"    INTEGER NOT NULL DEFAULT 0,
    "finalQty"       INTEGER NOT NULL,
    "bufferQty"      INTEGER NOT NULL DEFAULT 0,
    "adminAdjusted"  BOOLEAN NOT NULL DEFAULT false,
    "status"         "CookPlanStatus" NOT NULL DEFAULT 'SUGGESTED',
    "confirmedAt"    TIMESTAMP(3),
    "confirmedBy"    TEXT,
    "supersededById" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("date","menuItemId","status")
);

CREATE TABLE "ProcurementAlert" (
    "id"             TEXT PRIMARY KEY,
    "ingredientId"   TEXT NOT NULL REFERENCES "Ingredient"("id"),
    "date"           DATE NOT NULL,
    "currentStock"   DECIMAL(8,3) NOT NULL,
    "forecastedNeed" DECIMAL(8,3) NOT NULL,
    "deficit"        DECIMAL(8,3) NOT NULL,
    "tier"           TEXT NOT NULL DEFAULT 'CRITICAL',
    "isResolved"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProcurementAlert_date_isResolved_idx" ON "ProcurementAlert"("date","isResolved");

-- ─── Academic Calendar ──────────────────────────────────────────────────────
CREATE TABLE "AcademicCalendar" (
    "id"             TEXT PRIMARY KEY,
    "semesterPeriod" TEXT NOT NULL,
    "startDate"      DATE NOT NULL,
    "endDate"        DATE NOT NULL,
    "label"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL
);

-- ─── ML Training Log ────────────────────────────────────────────────────────
CREATE TABLE "TrainingLog" (
    "id"           TEXT PRIMARY KEY,
    "itemName"     TEXT NOT NULL,
    "rowsUsed"     INTEGER NOT NULL,
    "mae"          DOUBLE PRECISION NOT NULL,
    "r2"           DOUBLE PRECISION NOT NULL,
    "rolledBack"   BOOLEAN NOT NULL DEFAULT false,
    "modelVersion" TEXT NOT NULL,
    "trainedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TrainingLog_itemName_idx" ON "TrainingLog"("itemName");
CREATE INDEX "TrainingLog_trainedAt_idx" ON "TrainingLog"("trainedAt");

-- ─── Seed / Historical Data ─────────────────────────────────────────────────
CREATE TABLE "QueueTimeRecord" (
    "id"              TEXT PRIMARY KEY,
    "date"            DATE NOT NULL,
    "slotTime"        TEXT NOT NULL,
    "avgWaitMinutes"  INTEGER NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("date","slotTime")
);

