"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import type { OrderStatusPayload } from "@/lib/order-events";

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

  if (!visibleKey || !update) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={visibleKey}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg max-w-sm w-[calc(100%-2rem)] flex items-center gap-3"
        style={{
          background: "oklch(0.14 0.012 260)",
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
    </AnimatePresence>
  );
}
