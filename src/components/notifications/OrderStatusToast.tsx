"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell } from "lucide-react";
import type { OrderStatusPayload } from "@/lib/order-events";
import { springSnappy, fadeEase } from "@/lib/motion";

interface Props {
  update: OrderStatusPayload | null;
}

const statusLabel: Record<string, string> = {
  CONFIRMED: "confirmed",
  IN_PREPARATION: "being prepared",
  READY: "ready for pickup",
  COLLECTED: "collected",
};

export default function OrderStatusToast({ update }: Props) {
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  useEffect(() => {
    if (!update) return;
    const key = update.timestamp;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toast auto-dismiss timer
    setVisibleKey(key);
    const timer = setTimeout(() => setVisibleKey(null), 5000);
    return () => clearTimeout(timer);
  }, [update]);

  return (
    // Positioning wrapper handles centering — the motion child owns transform
    // (combining Tailwind -translate-x-1/2 with motion x would conflict).
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visibleKey && update && (
          <motion.div
            key={visibleKey}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ y: springSnappy, opacity: fadeEase }}
            className="pointer-events-auto px-4 py-3 rounded-xl shadow-lg max-w-sm w-full flex items-center gap-3"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--glass-border-strong)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-[var(--brand)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {update.orderNumber}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Your order is now {statusLabel[update.status] ?? update.status}
                {update.slotDisplay ? ` · ${update.slotDisplay}` : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
