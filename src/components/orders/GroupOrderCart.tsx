"use client";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { GroupCartItemData } from "@/types/group-order";

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
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
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
              <button
                onClick={() => onRemove(item.id)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-disabled)] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      ))}

      {/* Total */}
      <div className="flex items-center justify-between pt-2 px-3 border-t border-[rgba(255,255,255,0.05)]">
        <span className="text-xs font-medium text-[var(--text-muted)]">Group Total</span>
        <span className="text-sm font-bold text-[var(--brand)]">Rs.{total.toLocaleString()}</span>
      </div>
    </div>
  );
}
