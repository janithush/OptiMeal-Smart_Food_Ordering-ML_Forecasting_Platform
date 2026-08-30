-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add missing single-column indexes
--
-- Background: Phase 1 of the project added 4 single-column `@@index`
-- directives to `prisma/schema.prisma` (DemandForecast.date, WalletAccount.userId,
-- GroupOrderParticipant.studentId, GroupOrderCartItem.participantId) AFTER
-- the live Supabase database had already been initialized via `prisma db push`.
-- The `db push` never re-ran, so the production DB was missing these indexes,
-- causing full table scans on every relevant query.
--
-- This migration was hand-applied to production on 2026-08-30 via the Supabase
-- MCP. It is included here so future deploys (and `prisma migrate deploy`
-- runs) stay consistent with the live state.
--
-- Impact: high once data volume grows. The 4 indexed columns are on hot paths
-- (forecast lookup, wallet balance, group-order membership and cart sync).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "DemandForecast_date_idx"             ON public."DemandForecast"        (date);
CREATE INDEX IF NOT EXISTS "WalletAccount_userId_idx"            ON public."WalletAccount"        ("userId");
CREATE INDEX IF NOT EXISTS "GroupOrderParticipant_studentId_idx" ON public."GroupOrderParticipant" ("studentId");
CREATE INDEX IF NOT EXISTS "GroupOrderCartItem_participantId_idx" ON public."GroupOrderCartItem"   ("participantId");
