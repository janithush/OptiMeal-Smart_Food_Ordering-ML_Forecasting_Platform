"use client";

import { motion } from "motion/react";
import { CheckCircle } from "lucide-react";
import type { OrderResult } from "@/types/cart";
import QRDisplay from "@/components/orders/QRDisplay";
import { springSnappy, springGentle } from "@/lib/motion";

interface Props {
  order: OrderResult;
  onBackToMenu: () => void;
}

/**
 * Order confirmation CONTENT (no backdrop/positioning — the host sheet
 * provides the container so checkout morphs in place via AnimatePresence).
 */
export default function OrderConfirmationModal({ order, onBackToMenu }: Props) {
  return (
    <div className="px-5 py-5">
      {/* Success header */}
      <div className="pb-4 text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springSnappy}
          className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 mb-4"
        >
          <CheckCircle className="w-7 h-7 text-green-400" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.08 }}
        >
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Order Confirmed!</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{order.orderNumber}</p>
        </motion.div>
      </div>

      {/* Order details */}
      <div className="py-4 space-y-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">{item.menuItemName} × {item.quantity}</span>
            <span className="text-[var(--text-primary)]">Rs.{item.subtotal}</span>
          </div>
        ))}

        {order.pickupSlot && (
          <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[var(--text-muted)]">Pickup</span>
            <span className="text-[var(--brand)]">{order.pickupSlot.displayLabel}</span>
          </div>
        )}

        {!order.pickupSlot && order.type === "WALK_IN" && (
          <div className="text-center pt-2 space-y-1">
            <p className="text-xs text-amber-400">Walk-In Order &middot; Estimated wait ~15 min</p>
            <p className="text-[10px] text-amber-400/50">Earns 0 Canteen Coins</p>
          </div>
        )}

        <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[var(--text-primary)]">Total</span>
          <span className="text-[var(--brand)]">Rs.{order.totalAmount}</span>
        </div>
      </div>

      {/* QR Code — live (Story 3.4) */}
      <div className="py-4">
        <QRDisplay orderId={order.id} orderDate={order.createdAt} qrCodeString={order.qrCode} size={200} />
      </div>

      {/* CTA */}
      <div className="pb-1">
        <motion.button
          onClick={onBackToMenu}
          whileTap={{ scale: 0.96 }}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: "var(--brand)", color: "#000" }}
        >
          Back to Menu
        </motion.button>
      </div>
    </div>
  );
}
