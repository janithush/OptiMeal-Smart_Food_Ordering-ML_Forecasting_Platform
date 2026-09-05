"use client";

import { motion } from "motion/react";
import { Sparkles, Plus } from "lucide-react";
import type { RecommendedItem } from "@/lib/recommendations";

interface Props {
  items: RecommendedItem[];
  onAddToCart: (item: RecommendedItem) => void;
}

const dietaryBadge: Record<string, { emoji: string; label: string }> = {
  VEGAN: { emoji: "🌱", label: "Vegan" },
  VEGETARIAN: { emoji: "🥬", label: "Veg" },
  NON_VEGETARIAN: { emoji: "🍗", label: "Non-Veg" },
};

export default function RecommendedSection({ items, onAddToCart }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-1">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Recommended for You</h2>
        <span className="text-[10px] text-[var(--text-disabled)]">based on your peers</span>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {items.map((item) => {
          const badge = dietaryBadge[item.dietaryType] ?? { emoji: "", label: item.dietaryType };
          return (
            <motion.div
              key={item.menuItemId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="shrink-0 w-44 rounded-xl p-3 transition-all"
              style={{
                background: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {/* Item name + dietary badge */}
              <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-2 mb-1.5">
                {item.name}
              </p>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-disabled)]">
                  {badge.emoji} {badge.label}
                </span>
                {item.specialPrice && item.specialPrice < item.basePrice && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border border-white/10" style={{ background: "rgb(88,28,135)", color: "rgb(233,213,255)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    SPECIAL
                  </span>
                )}
              </div>

              {/* Reason label */}
              <p className="text-[10px] text-purple-400/70 italic mb-2">
                {item.reason}
              </p>

              {/* Price + Add button */}
              <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <div>
                  {item.specialPrice && item.specialPrice < item.basePrice ? (
                    <>
                      <span className="text-[10px] text-[var(--text-disabled)] line-through mr-1">Rs.{item.basePrice}</span>
                      <span className="text-xs font-bold text-purple-400">Rs.{item.specialPrice}</span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-[var(--brand)]">Rs.{item.basePrice}</span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onAddToCart(item)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--brand)]/15 hover:bg-[var(--brand)]/25 text-[var(--brand)] text-[10px] font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
