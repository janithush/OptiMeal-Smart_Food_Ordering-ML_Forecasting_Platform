"use client";

import { motion } from "motion/react";
import { springSnappy } from "@/lib/motion";
import { ShoppingBag, FileText } from "lucide-react";

export interface ProcurementAlertPayload {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  forecastedNeed: number;
  deficit: number;
  reorderQty: number;
  tier?: string;
}

interface Props {
  alert: ProcurementAlertPayload;
  onGeneratePO?: () => void;
  poGenerating?: boolean;
}

/**
 * ProcurementAlertCard — Displays a procurement alert card when an
 * ingredient's stock is below forecasted need. Admin can click to
 * generate a PDF Purchase Order.
 * Story 7.2: Procurement Alerts (FR-27)
 */
export default function ProcurementAlertCard({
  alert,
  onGeneratePO,
  poGenerating,
}: Props) {
  const isCritical = alert.tier === "CRITICAL" || (!alert.tier && alert.deficit > 0);

  const accentColor = isCritical
    ? "oklch(0.55 0.20 15)" // red
    : "oklch(0.62 0.19 80)"; // amber

  const tierLabel = isCritical ? "Critical" : "Warning";
  const percentDeficit = alert.deficit > 0
    ? Math.round((alert.deficit / alert.forecastedNeed) * 100)
    : Math.round(((alert.forecastedNeed - alert.currentStock) / alert.forecastedNeed) * -100);

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
        {/* Icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accentColor} / 0.15`,
            color: accentColor,
          }}
        >
          <ShoppingBag className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {alert.ingredientName}
            <span
              className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
              style={{
                background: `${accentColor} / 0.2`,
                color: accentColor,
              }}
            >
              {tierLabel}
            </span>
          </h4>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5 text-xs">
            <span className="text-[var(--text-muted)]">
              Stock:{" "}
              <span className="text-[var(--text-primary)] font-mono font-semibold">
                {alert.currentStock.toFixed(3)}
              </span>{" "}
              {alert.unit}
            </span>
            <span className="text-[var(--text-muted)]">
              Need:{" "}
              <span className="text-[var(--text-primary)] font-mono font-semibold">
                {alert.forecastedNeed.toFixed(3)}
              </span>{" "}
              {alert.unit}
            </span>
          </div>

          {/* Deficit bar */}
          <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.abs(percentDeficit), 100)}%` }}
              transition={springSnappy}
              className="h-full rounded-full"
              style={{ background: accentColor }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: accentColor }}
            >
              {alert.deficit > 0
                ? `${alert.deficit.toFixed(3)} ${alert.unit} deficit (${percentDeficit}%)`
                : `Stock running low — within 15% buffer`}
            </span>
            {alert.reorderQty > 0 && (
              <span className="text-[10px] text-[var(--text-disabled)]">
                Reorder: {alert.reorderQty.toFixed(1)} {alert.unit}
              </span>
            )}
          </div>
        </div>

        {/* Generate PO button */}
        {onGeneratePO && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onGeneratePO}
            disabled={poGenerating}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor} / 0.8)`,
            }}
          >
            {poGenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Generate PO
              </>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
