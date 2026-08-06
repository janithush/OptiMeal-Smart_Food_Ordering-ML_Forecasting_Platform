"use client";

import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import type { OrderResult } from "@/types/cart";
import QRDisplay from "@/components/orders/QRDisplay";

interface Props {
  order: OrderResult;
  onBackToMenu: () => void;
}

export default function OrderConfirmationModal({ order, onBackToMenu }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "oklch(0.1 0.01 260)", border: "1px solid var(--glass-border)" }}
      >
        {/* Success header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Order Confirmed!</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{order.orderNumber}</p>
        </div>

        {/* Order details */}
        <div className="px-6 py-4 space-y-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
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
            <div className="text-center text-xs text-amber-400 pt-2">Walk-In Order</div>
          )}

          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[var(--text-primary)]">Total</span>
            <span className="text-[var(--brand)]">Rs.{order.totalAmount}</span>
          </div>
        </div>

        {/* QR Code — live (Story 3.4) */}
        <div className="px-6 py-4">
          <QRDisplay orderId={order.id} orderDate={order.createdAt} qrCodeString={order.qrCode} size={200} />
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={onBackToMenu}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
            style={{ background: "var(--brand)", color: "#000" }}
          >
            Back to Menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
