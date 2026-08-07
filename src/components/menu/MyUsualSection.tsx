"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import type { MyUsualCombo } from "@/lib/my-usual";

interface Props {
  combos: MyUsualCombo[];
  onReorder: (combo: MyUsualCombo) => void;
}

export default function MyUsualSection({ combos, onReorder }: Props) {
  if (combos.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-1">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-[var(--text-primary)]">My Usual</h2>
        <span className="text-[10px] text-[var(--text-disabled)]">one-tap reorder</span>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {combos.map((combo) => (
          <motion.button
            key={combo.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onReorder(combo)}
            className="shrink-0 w-44 rounded-xl p-3 text-left transition-all"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-2 mb-1.5">{combo.label}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{combo.items.length} item{combo.items.length !== 1 ? "s" : ""}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-disabled)]">{combo.orderCount}×</span>
              {combo.items.some((it) => it.hasSpecial) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border border-white/10" style={{ background: "rgb(88,28,135)", color: "rgb(233,213,255)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>SPECIAL</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
              <span className="text-xs font-bold text-[var(--brand)]">Rs.{combo.totalPrice}</span>
              <span className="text-[10px] text-[var(--brand)]">Reorder →</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
