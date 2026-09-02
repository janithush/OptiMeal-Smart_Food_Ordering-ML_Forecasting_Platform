/**
 * system-settings.ts — Canteen-wide configuration singleton.
 *
 * Reads/writes the SystemSettings row. Caches the result in process memory
 * with a 60-second TTL to avoid hitting the database on every request.
 * The cache is invalidated by `updateSystemSettings()` and on a `systemSettingsChanged`
 * socket event.
 */

import { prisma } from "@/lib/prisma";
import type { SystemSettings } from "@prisma/client";

// ── Cache ────────────────────────────────────────────────────────
let cached: { value: SystemSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

// ── Defaults (must match schema.prisma defaults) ────────────────
export const DEFAULT_SYSTEM_SETTINGS = {
  id: "singleton",
  canteenName: "QuickBite Canteen",
  canteenLogoUrl: null,
  canteenContactEmail: null,
  canteenContactPhone: null,
  currencyCode: "LKR",
  currencySymbol: "Rs.",
  preOrderCutoffTime: "09:00",
  pickupSlotStart: "11:30",
  pickupSlotEnd: "13:15",
  pickupSlotIntervalMin: 15,
  defaultSlotCapacity: 30,
  minTopupAmount: 100,
  maxTopupAmount: 50000,
  maxCoinRedemption: 100,
  mlConfidenceThreshold: 70.0,
  smartDiscountThreshold: 30.0,
  smartDiscountCheckTime: "12:30",
  enableGroupOrders: true,
  enableFlashDeals: true,
  enableCoinsLoyalty: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  updatedBy: null,
} as const;

// ── Validation helpers ───────────────────────────────────────────

/** Validate a HH:MM time string. */
export function isValidHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Parse "HH:MM" → total minutes. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes → "HH:MM". */
function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Validate a partial SystemSettings patch.
 * Returns null if valid, or an error message string describing the first violation.
 */
export function validateSystemSettingsPatch(
  patch: Partial<Omit<SystemSettings, "id" | "createdAt" | "updatedAt">>
): string | null {
  // Time-format checks
  for (const k of ["preOrderCutoffTime", "pickupSlotStart", "pickupSlotEnd", "smartDiscountCheckTime"] as const) {
    if (patch[k] !== undefined && !isValidHHMM(patch[k]!)) {
      return `${k} must be in HH:MM format (got "${patch[k]}")`;
    }
  }

  // cutoff < pickupSlotStart
  if (patch.preOrderCutoffTime !== undefined && patch.pickupSlotStart !== undefined) {
    if (toMinutes(patch.preOrderCutoffTime) >= toMinutes(patch.pickupSlotStart)) {
      return "preOrderCutoffTime must be before pickupSlotStart";
    }
  }

  // pickupSlotEnd - pickupSlotStart must be a positive multiple of interval
  if (
    patch.pickupSlotStart !== undefined &&
    patch.pickupSlotEnd !== undefined &&
    patch.pickupSlotIntervalMin !== undefined
  ) {
    const diff = toMinutes(patch.pickupSlotEnd) - toMinutes(patch.pickupSlotStart);
    if (diff <= 0) return "pickupSlotEnd must be after pickupSlotStart";
    if (diff % patch.pickupSlotIntervalMin !== 0) {
      return `pickupSlot window (${diff} min) must be a multiple of pickupSlotIntervalMin (${patch.pickupSlotIntervalMin} min)`;
    }
  }

  // Interval bounds
  if (patch.pickupSlotIntervalMin !== undefined) {
    if (patch.pickupSlotIntervalMin < 5 || patch.pickupSlotIntervalMin > 60) {
      return "pickupSlotIntervalMin must be between 5 and 60 minutes";
    }
  }

  // Slot capacity
  if (patch.defaultSlotCapacity !== undefined) {
    if (patch.defaultSlotCapacity < 1 || patch.defaultSlotCapacity > 200) {
      return "defaultSlotCapacity must be between 1 and 200";
    }
  }

  // Top-up range
  if (patch.minTopupAmount !== undefined && patch.maxTopupAmount !== undefined) {
    if (Number(patch.minTopupAmount) >= Number(patch.maxTopupAmount)) {
      return "minTopupAmount must be less than maxTopupAmount";
    }
  }
  if (patch.minTopupAmount !== undefined && Number(patch.minTopupAmount) < 1) {
    return "minTopupAmount must be at least 1";
  }
  if (patch.maxTopupAmount !== undefined && Number(patch.maxTopupAmount) > 1_000_000) {
    return "maxTopupAmount cannot exceed 1,000,000";
  }

  // Coin redemption
  if (patch.maxCoinRedemption !== undefined) {
    if (patch.maxCoinRedemption < 0 || patch.maxCoinRedemption > 1000) {
      return "maxCoinRedemption must be between 0 and 1000";
    }
  }

  // Thresholds
  if (patch.mlConfidenceThreshold !== undefined) {
    const v = Number(patch.mlConfidenceThreshold);
    if (v < 0 || v > 100) return "mlConfidenceThreshold must be between 0 and 100";
  }
  if (patch.smartDiscountThreshold !== undefined) {
    const v = Number(patch.smartDiscountThreshold);
    if (v < 0 || v > 100) return "smartDiscountThreshold must be between 0 and 100";
  }

  return null;
}

// ── Public API ───────────────────────────────────────────────────

/** Read the singleton SystemSettings row. Seeds defaults on first call. */
export async function getSystemSettings(): Promise<SystemSettings> {
  // Try cache first
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let row = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await prisma.systemSettings.create({
      data: { ...DEFAULT_SYSTEM_SETTINGS },
    });
  }

  cached = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
  return row;
}

/** Cached getter — same as getSystemSettings but cached in memory. */
export async function getSystemSettingsCached(): Promise<SystemSettings> {
  return getSystemSettings();
}

/** Force cache invalidation. Called after any write. */
export function invalidateSystemSettingsCache() {
  cached = null;
}

/**
 * Patch SystemSettings. Validates first, writes to DB, invalidates cache,
 * and emits a `systemSettingsChanged` socket event.
 * Returns the updated row, or throws on validation error.
 */
export async function updateSystemSettings(
  patch: Partial<Omit<SystemSettings, "id" | "createdAt" | "updatedAt">>,
  actorId: string
): Promise<SystemSettings> {
  const validationError = validateSystemSettingsPatch(patch);
  if (validationError) {
    throw new Error(validationError);
  }

  // Read current for audit log diff
  const before = await getSystemSettings();

  const updated = await prisma.systemSettings.update({
    where: { id: "singleton" },
    data: { ...patch, updatedBy: actorId },
  });

  invalidateSystemSettingsCache();

  // Compute diff for audit + socket
  const diffKeys: string[] = [];
  for (const k of Object.keys(patch)) {
    const key = k as keyof SystemSettings;
    if (before[key] !== updated[key]) diffKeys.push(k);
  }

  // Audit log (best-effort)
  await prisma.adminAuditLog.create({
    data: {
      actorId,
      action: "SETTINGS_UPDATED",
      metadata: JSON.stringify({
        changed: diffKeys,
        before: Object.fromEntries(diffKeys.map((k) => [k, before[k as keyof SystemSettings]])),
        after: Object.fromEntries(diffKeys.map((k) => [k, updated[k as keyof SystemSettings]])),
      }),
    },
  }).catch(() => {
    /* audit log failure must not break settings update */
  });

  // Emit socket event (best-effort)
  try {
    const { getIO } = await import("@/lib/socket-server");
    const io = getIO();
    io.of("/admin").emit("systemSettingsChanged", {
      changedBy: actorId,
      fields: diffKeys,
      timestamp: new Date().toISOString(),
    });
  } catch {
    /* IO not initialized */
  }

  return updated;
}

/** Compute the pickup-slot times list from current settings. */
export async function getPickupSlotTimes(): Promise<string[]> {
  const s = await getSystemSettingsCached();
  const startMin = toMinutes(s.pickupSlotStart);
  const endMin = toMinutes(s.pickupSlotEnd);
  const out: string[] = [];
  for (let m = startMin; m < endMin; m += s.pickupSlotIntervalMin) {
    out.push(fromMinutes(m));
  }
  return out;
}

/** Compute slot display label (e.g., "11:30 - 11:45"). */
export function toSlotDisplayLabel(slotTime: string, intervalMin: number): string {
  const [h, m] = slotTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + intervalMin;
  const endH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const endM = String(totalMinutes % 60).padStart(2, "0");
  return `${slotTime} - ${endH}:${endM}`;
}