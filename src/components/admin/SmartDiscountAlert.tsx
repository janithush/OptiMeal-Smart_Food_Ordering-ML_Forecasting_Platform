"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Zap } from "lucide-react";
import type { SmartDiscountAlertPayload } from "@/lib/order-events";

interface Props {
  alert: SmartDiscountAlertPayload;
  onCreateDeal: (menuItemId: string, name: string) => void;
}

/**
 * SmartDiscountAlert — Displays a warning card when an item's sales
 * are below 30% of its Cook Plan target. Admin can tap to create
 * a Flash Deal for that item.
 * Story 6.4: Smart Discount Trigger (FR-25)
 */
export default function SmartDiscountAlert({ alert, onCreateDeal }: Props) {
  const isCritical = alert.percentSold < 15;
  const accentColor = isCritical
    ? "oklch(0.55 0.20 15)" // red
    : "oklch(0.62 0.19 80)"; // amber

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
      }}
    >
      {/* Glow accent */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-25 -translate-y-1/2 translate-x-1/2"
        style={{ background: accentColor }}
      />

      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accentColor} / 0.15`,
            color: accentColor,
          }}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {alert.name}
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Only {alert.unitsSold} of {alert.cookPlanTarget} sold
          </p>

          {/* Progress bar */}
          <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(alert.percentSold, 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: accentColor }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: accentColor }}
            >
              {alert.percentSold.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[var(--text-disabled)]">
              Target: {alert.cookPlanTarget} @ Rs.{alert.currentPrice}
            </span>
          </div>
        </div>

        {/* Create Deal CTA */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCreateDeal(alert.menuItemId, alert.name)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor} / 0.8)` }}
        >
          <Zap className="w-3.5 h-3.5" />
          Flash Deal
        </motion.button>
      </div>
    </motion.div>
  );
}
