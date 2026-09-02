-- AlterTable: add soft-delete and last-login fields to User
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateTable: AdminInvitation
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitedByName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemSettings
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "canteenName" TEXT NOT NULL DEFAULT 'QuickBite Canteen',
    "canteenLogoUrl" TEXT,
    "canteenContactEmail" TEXT,
    "canteenContactPhone" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'LKR',
    "currencySymbol" TEXT NOT NULL DEFAULT 'Rs.',
    "preOrderCutoffTime" TEXT NOT NULL DEFAULT '09:00',
    "pickupSlotStart" TEXT NOT NULL DEFAULT '11:30',
    "pickupSlotEnd" TEXT NOT NULL DEFAULT '13:15',
    "pickupSlotIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "defaultSlotCapacity" INTEGER NOT NULL DEFAULT 30,
    "minTopupAmount" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "maxTopupAmount" DECIMAL(8,2) NOT NULL DEFAULT 50000,
    "maxCoinRedemption" INTEGER NOT NULL DEFAULT 100,
    "mlConfidenceThreshold" DECIMAL(5,2) NOT NULL DEFAULT 70.0,
    "smartDiscountThreshold" DECIMAL(5,2) NOT NULL DEFAULT 30.0,
    "smartDiscountCheckTime" TEXT NOT NULL DEFAULT '12:30',
    "enableGroupOrders" BOOLEAN NOT NULL DEFAULT true,
    "enableFlashDeals" BOOLEAN NOT NULL DEFAULT true,
    "enableCoinsLoyalty" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminAuditLog
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_token_key" ON "AdminInvitation"("token");
CREATE INDEX "AdminInvitation_email_idx" ON "AdminInvitation"("email");
CREATE INDEX "AdminInvitation_token_idx" ON "AdminInvitation"("token");
CREATE INDEX "AdminInvitation_expiresAt_idx" ON "AdminInvitation"("expiresAt");
CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
