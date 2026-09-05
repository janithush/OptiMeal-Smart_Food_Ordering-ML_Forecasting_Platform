"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import QRDisplay from "./QRDisplay";
import { springSnappy, springGentle, fadeEase } from "@/lib/motion";

interface OrderItemData {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  totalAmount: number;
  qrCode: string;
  pickupSlot?: { slotTime: string; displayLabel?: string } | null;
  items: OrderItemData[];
  createdAt: string;
}

interface Props {
  order: OrderData;
  isExpanded: boolean;
  onToggle: () => void;
}

const statusSteps = ["CONFIRMED", "IN_PREPARATION", "READY", "COLLECTED"] as const;
const statusLabels: Record<string, string> = {
  CONFIRMED: "Confirmed",
  IN_PREPARATION: "In Preparation",
  READY: "Ready",
  COLLECTED: "Collected",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OrderDetail({ order, isExpanded, onToggle }: Props) {
  const currentIdx = statusSteps.indexOf(order.status as typeof statusSteps[number]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      {/* Summary Row */}
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        aria-expanded={isExpanded}
        className="w-full text-left p-4 flex items-center justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[var(--text-primary)]">{order.orderNumber}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${order.type === "PRE_ORDER" ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "bg-amber-500/10 text-amber-400"}`}>
              {order.type === "PRE_ORDER" ? "Pre-Order" : "Walk-In"}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {formatDate(order.createdAt)}
            {order.pickupSlot && ` · ${order.pickupSlot.displayLabel ?? order.pickupSlot.slotTime}`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-[var(--brand)]">Rs.{order.totalAmount}</span>
        </div>
        <motion.span
          initial={false}
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={springSnappy}
          className="flex"
        >
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        </motion.span>
      </motion.button>

      {/* Expanded Detail */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: springGentle, opacity: fadeEase }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
              {/* Items */}
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{item.menuItemName} × {item.quantity}</span>
                    <span className="text-[var(--text-primary)]">Rs.{item.subtotal}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-primary)]">Total</span>
                  <span className="text-[var(--brand)]">Rs.{order.totalAmount}</span>
                </div>
              </div>

              {/* Status Timeline — dots + connectors morph live on socket updates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={order.status}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={fadeEase}
                      className="text-[11px] font-semibold text-[var(--brand)]"
                    >
                      {statusLabels[order.status] ?? order.status}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1">
                  {statusSteps.map((step, i) => (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <motion.div
                        initial={false}
                        animate={{ scale: i === currentIdx ? [1, 1.5, 1] : 1 }}
                        transition={springSnappy}
                        className={`w-3 h-3 rounded-full shrink-0 ${i <= currentIdx ? (i === currentIdx ? "bg-amber-400" : "bg-green-500") : "bg-white/10"}`}
                      />
                      {i < 3 && (
                        <motion.div
                          initial={false}
                          animate={{ opacity: i < currentIdx ? 1 : 0.4 }}
                          transition={fadeEase}
                          className={`flex-1 h-0.5 ${i < currentIdx ? "bg-green-500" : "bg-white/10"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {statusSteps.map((step) => (
                    <span key={step} className="text-[9px] text-[var(--text-muted)]">{statusLabels[step]}</span>
                  ))}
                </div>
              </div>

              {/* QR Code */}
              <div className="pt-2">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Pickup Pass</p>
                <QRDisplay orderId={order.id} orderDate={order.createdAt} qrCodeString={order.qrCode} size={180} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
