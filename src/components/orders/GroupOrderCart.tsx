"use client";

import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";
import type { GroupCartItemData } from "@/types/group-order";
import { listItem, fadeEase, HIT_SLOP } from "@/lib/motion";

interface Props {
  items: GroupCartItemData[];
  currentUserId: string;
  onRemove: (itemId: string) => void;
}

const dietaryBadge: Record<string, string> = {
  VEGAN: "🌱",
  VEGETARIAN: "🥬",
  NON_VEGETARIAN: "🍗",
};

export default function GroupOrderCart({ items, currentUserId, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-muted)]">No items yet. Start adding from the menu below!</p>
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + i.basePrice * i.quantity, 0);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            variants={listItem}
            initial="hidden"
            animate="shown"
            exit="gone"
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {item.menuItemName}
                <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                  {dietaryBadge[item.dietaryType] ?? ""}
                </span>
              </p>
              <p className="text-[10px] text-[var(--text-disabled)]">
                {item.participantName} · ×{item.quantity}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--brand)]">
                Rs.{(item.basePrice * item.quantity).toLocaleString()}
              </span>
              {item.participantId === currentUserId && (
                <motion.button
                  onClick={() => onRemove(item.id)}
                  whileTap={{ scale: 0.96 }}
                  aria-label={`Remove ${item.menuItemName}`}
                  className={`p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-disabled)] hover:text-red-400 transition-colors ${HIT_SLOP}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Total */}
      <motion.div
        key="group-total"
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeEase}
        className="flex items-center justify-between pt-2 px-3 border-t border-[var(--border-subtle)]"
      >
        <span className="text-xs font-medium text-[var(--text-muted)]">Group Total</span>
        <span className="text-sm font-bold text-[var(--brand)]">Rs.{total.toLocaleString()}</span>
      </motion.div>
    </div>
  );
}
