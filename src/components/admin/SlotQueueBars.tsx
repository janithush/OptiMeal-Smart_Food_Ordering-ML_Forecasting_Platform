"use client";

import { motion } from "framer-motion";

interface Props {
  slots: { slotId: string; label: string; depth: number; max: number }[];
}

function depthColor(depth: number, max: number): string {
  const pct = max > 0 ? depth / max : 0;
  if (pct >= 0.9) return "bg-red-500";
  if (pct >= 0.6) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function SlotQueueBars({ slots }: Props) {
  if (slots.length === 0) return null;

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Pickup Slot Queue</h3>
      <div className="space-y-3">
        {slots.map((slot) => {
          const pct = slot.max > 0 ? Math.round((slot.depth / slot.max) * 100) : 0;
          return (
            <div key={slot.slotId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[var(--text-primary)]">{slot.label}</span>
                <span className={`text-[11px] font-bold ${pct >= 90 ? "text-red-400" : pct >= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                  {slot.depth}/{slot.max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${depthColor(slot.depth, slot.max)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
