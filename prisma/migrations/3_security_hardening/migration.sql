-- ─────────────────────────────────────────────────────────────────────────────
-- CaféSmart migration 3_security_hardening
--
-- Adapts the logistics security audit to the canteen domain:
--   tonnage CHECK        → price / quantity / discount CHECKs
--   trip revenue GENERATED → on-disk OrderItem.subtotal + Order.totalAmount
--                            triggers (DB is authoritative, app values ignored)
--   company RLS          → student-data RLS (fail-closed deny by default)
--
-- Compatible with PostgreSQL 14–17 (Supabase pooler + self-hosted).
-- Safe to run via `prisma migrate deploy`. Constraints use DO blocks so
-- re-runs do not error on existing constraint names.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ 1. Physical data limits (CHECK constraints) ═══════════════════════════

DO $$ BEGIN
  ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_basePrice_check" CHECK ("basePrice" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" >= 1 AND "quantity" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPrice_check" CHECK ("unitPrice" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subtotal_check" CHECK ("subtotal" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_totalAmount_check" CHECK ("totalAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_coinsRedeemed_check" CHECK ("coinsRedeemed" >= 0 AND "coinsRedeemed" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_discountAmount_check" CHECK ("discountAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlashDeal" ADD CONSTRAINT "FlashDeal_discountPercent_check" CHECK ("discountPercent" >= 1 AND "discountPercent" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PickupSlot" ADD CONSTRAINT "PickupSlot_capacity_check" CHECK ("maxCapacity" > 0 AND "currentCount" >= 0 AND "currentCount" <= "maxCapacity");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DailySpecial" ADD CONSTRAINT "DailySpecial_specialPrice_check" CHECK ("specialPrice" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoinBatch" ADD CONSTRAINT "CoinBatch_earned_check" CHECK ("earned" > 0 AND "redeemed" >= 0 AND "redeemed" <= "earned");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_amount_check" CHECK ("amount" <> 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuItemIngredient" ADD CONSTRAINT "MenuItemIngredient_qty_check" CHECK ("quantityPerPortion" > 0 AND "quantityPerPortion" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 2. On-disk revenue calculation (tamper-proof triggers) ════════════════
-- DB is authoritative: subtotal is recomputed from qty × unitPrice and
-- Order.totalAmount is recomputed as SUM(subtotal). App-supplied values
-- that disagree are silently corrected (never trusted).

CREATE OR REPLACE FUNCTION enforce_order_item_subtotal()
RETURNS trigger AS $$
BEGIN
  NEW."subtotal" := ROUND((NEW."quantity" * NEW."unitPrice")::numeric, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_item_subtotal ON "OrderItem";
CREATE TRIGGER trg_order_item_subtotal
BEFORE INSERT OR UPDATE OF "quantity", "unitPrice" ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION enforce_order_item_subtotal();

CREATE OR REPLACE FUNCTION recompute_order_total()
RETURNS trigger AS $$
BEGIN
  UPDATE "Order" o
  SET "totalAmount" = COALESCE(
    (SELECT ROUND(SUM(oi."subtotal")::numeric, 2) FROM "OrderItem" oi WHERE oi."orderId" = COALESCE(NEW."orderId", OLD."orderId")),
    0
  ),
  "updatedAt" = NOW()
  WHERE o."id" = COALESCE(NEW."orderId", OLD."orderId");
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_total_on_item ON "OrderItem";
CREATE TRIGGER trg_order_total_on_item
AFTER INSERT OR UPDATE OR DELETE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION recompute_order_total();

-- ═══ 3. Row-Level Security (fail-closed, student isolation) ═════════════════
-- Prisma connects as the table owner (service role) and bypasses RLS —
-- RLS protects direct PostgREST / Supabase-API access. Default is DENY.
-- App sets `app.current_user_id` per request when using a limited role:
--   SET LOCAL "app.current_user_id" = '<user-uuid>';

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

-- Enable RLS on student-owned tables.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoinBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupOrderParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupOrderCartItem" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to keep migration idempotent.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- anon: deny everything (fail-closed).
CREATE POLICY "deny_anon_all" ON "User" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "WalletAccount" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "WalletTransaction" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "Order" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "OrderItem" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "CoinBatch" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "GroupOrder" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "GroupOrderParticipant" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_all" ON "GroupOrderCartItem" FOR ALL TO anon USING (false);

-- authenticated: own rows only via app.current_user_id (fail-closed default).
CREATE POLICY "own_user_row" ON "User" FOR ALL TO authenticated
  USING ("id" = app_current_user_id()) WITH CHECK ("id" = app_current_user_id());

CREATE POLICY "own_wallet" ON "WalletAccount" FOR ALL TO authenticated
  USING ("userId" = app_current_user_id()) WITH CHECK ("userId" = app_current_user_id());

CREATE POLICY "own_coins" ON "CoinBatch" FOR ALL TO authenticated
  USING ("userId" = app_current_user_id()) WITH CHECK ("userId" = app_current_user_id());

CREATE POLICY "own_orders" ON "Order" FOR ALL TO authenticated
  USING ("studentId" = app_current_user_id()) WITH CHECK ("studentId" = app_current_user_id());

-- OrderItem / WalletTransaction / Group children: no direct authenticated
-- access — reachable only through parent order/wallet checks server-side.
CREATE POLICY "deny_direct_items" ON "OrderItem" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_direct_tx" ON "WalletTransaction" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_direct_group" ON "GroupOrder" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_direct_participants" ON "GroupOrderParticipant" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_direct_cart" ON "GroupOrderCartItem" FOR ALL TO authenticated USING (false);
