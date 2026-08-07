"use client";

import { motion } from "framer-motion";
import { Package } from "lucide-react";

interface Props {
  items: { name: string; units: number }[];
}

export default function ItemSalesList({ items }: Props) {
  if (items.length === 0) return null;

  const maxUnits = Math.max(...items.map((i) => i.units), 1);

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Top Items Sold</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <span className="text-[10px] font-mono text-[var(--text-disabled)] w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-primary)] truncate">{item.name}</span>
                <span className="text-xs font-bold text-[var(--text-secondary)] ml-2">{item.units}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.units / maxUnits) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="h-full rounded-full bg-[var(--brand)]"
                />
              </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-4 text-[var(--text-disabled)]">
            <Package className="w-4 h-4" />
            <span className="text-xs">No items sold yet today</span>
          </div>
        )}
      </div>
    </div>
  );
}
