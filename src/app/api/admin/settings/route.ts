import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getSystemSettings,
  updateSystemSettings,
} from "@/lib/system-settings";

/**
 * GET /api/admin/settings — Read the singleton SystemSettings row.
 * PATCH /api/admin/settings — Partial update; validates every field.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const settings = await getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allow-list of fields that can be patched
  const PATCHABLE_FIELDS = [
    "canteenName",
    "canteenLogoUrl",
    "canteenContactEmail",
    "canteenContactPhone",
    "currencyCode",
    "currencySymbol",
    "preOrderCutoffTime",
    "pickupSlotStart",
    "pickupSlotEnd",
    "pickupSlotIntervalMin",
    "defaultSlotCapacity",
    "minTopupAmount",
    "maxTopupAmount",
    "maxCoinRedemption",
    "mlConfidenceThreshold",
    "smartDiscountThreshold",
    "smartDiscountCheckTime",
    "enableGroupOrders",
    "enableFlashDeals",
    "enableCoinsLoyalty",
    "maintenanceMode",
    "maintenanceMessage",
  ] as const;

  type PatchableKey = (typeof PATCHABLE_FIELDS)[number];
  const patch: Partial<Record<PatchableKey, unknown>> = {};

  for (const k of PATCHABLE_FIELDS) {
    if (body[k] !== undefined) {
      // Type coercion: numbers and decimals arrive as strings or numbers
      if (
        [
          "pickupSlotIntervalMin",
          "defaultSlotCapacity",
          "maxCoinRedemption",
        ].includes(k)
      ) {
        const n = Number(body[k]);
        if (!Number.isFinite(n)) {
          return NextResponse.json(
            { error: `${k} must be a number` },
            { status: 400 }
          );
        }
        patch[k] = n;
      } else if (
        [
          "minTopupAmount",
          "maxTopupAmount",
          "mlConfidenceThreshold",
          "smartDiscountThreshold",
        ].includes(k)
      ) {
        const n = Number(body[k]);
        if (!Number.isFinite(n)) {
          return NextResponse.json(
            { error: `${k} must be a number` },
            { status: 400 }
          );
        }
        patch[k] = n;
      } else if (
        [
          "enableGroupOrders",
          "enableFlashDeals",
          "enableCoinsLoyalty",
          "maintenanceMode",
        ].includes(k)
      ) {
        patch[k] = Boolean(body[k]);
      } else {
        patch[k] = body[k] === null || body[k] === undefined
          ? null
          : String(body[k]);
      }
    }
  }

  try {
    const updated = await updateSystemSettings(
      patch as never,
      auth.session.user.id
    );
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}