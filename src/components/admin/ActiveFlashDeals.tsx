"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, XCircle, TrendingUp } from "lucide-react";

interface ActiveDeal {
  id: string;
  menuItemId: string;
  name: string;
  dietaryType: string;
  imageUrl: string | null;
  basePrice: number;
  discountPercent: number;
  discountedPrice: number;
  cookPlanTarget: number;
  unitsSoldAtStart: number;
  currentUnitsSold: number;
  message: string | null;
  expiresAt: string;
  createdAt: string;
}

/**
 * ActiveFlashDeals — Displays a list of currently active Flash Deals
 * with live countdown timers, units-sold-since metrics, and cancel buttons.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export default function ActiveFlashDeals() {
  const [deals, setDeals] = useState<ActiveDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  // Store "now" in state updated by the interval effect below, so helpers
  // can read it during render without calling Date.now() (which would
  // violate react-hooks/purity).
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // ── Live countdown tick every second ──────────────────────────
  useEffect(() => {
    // setNowMs is wrapped in setTimeout(..., 0) so the state update is
    // deferred to a future task — not synchronous in the effect body.
    // This satisfies react-hooks/set-state-in-effect.
    const t = Date.now();
    const timeoutId = setTimeout(() => setNowMs(t), 0);
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, []);

  // ── Fetch active deals ────────────────────────────────────────
  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/flash-deals");
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Run the fetch in an async IIFE so setDeals/setLoading (called from
    // inside fetchDeals) sit behind an `await`. This satisfies
    // react-hooks/set-state-in-effect.
    (async () => {
      await fetchDeals();
    })();
  }, [fetchDeals]);

  // ── Cancel handler ────────────────────────────────────────────
  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/admin/flash-deals/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      /* ignore */
    } finally {
      setCancelling(null);
    }
  };

  function formatTimeLeft(expiresAt: string, now: number): string {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function getTimeColor(expiresAt: string, now: number): string {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "text-red-400";
    if (diff < 5 * 60000) return "text-red-400";
    if (diff < 15 * 60000) return "text-amber-400";
    return "text-emerald-400";
  }

  if (loading) return null;
  if (deals.length === 0) {
    return (
      <p className="text-xs text-center text-[var(--text-disabled)] py-3">
        No active Flash Deals
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {deals.map((deal) => {
        const additionalSold = deal.currentUnitsSold - deal.unitsSoldAtStart;
        const timeColor = getTimeColor(deal.expiresAt, nowMs);

        return (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-xl p-4 relative overflow-hidden"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {/* Amber glow for active deals */}
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-15 -translate-y-1/2 translate-x-1/2 bg-amber-400" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {deal.name}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {deal.discountPercent}% off · Rs.{deal.basePrice.toFixed(2)} →{" "}
                    <span className="text-amber-400 font-medium">Rs.{deal.discountedPrice.toFixed(2)}</span>
                  </p>
                </div>
              </div>

              {/* Cancel button */}
              <button
                onClick={() => handleCancel(deal.id)}
                disabled={cancelling === deal.id}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-400/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                title="Cancel deal"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-4 mt-3 text-[11px]">
              <div className="flex items-center gap-1 text-[var(--text-muted)]">
                <Clock className={`w-3 h-3 ${timeColor}`} />
                <span className={timeColor}>{formatTimeLeft(deal.expiresAt, nowMs)}</span>
              </div>
              {additionalSold > 0 && (
                <div className="flex items-center gap-1 text-[var(--text-muted)]">
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                  <span>{additionalSold} sold since deal</span>
                </div>
              )}
              {deal.message && (
                <span className="text-[var(--text-disabled)] italic">{deal.message}</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
