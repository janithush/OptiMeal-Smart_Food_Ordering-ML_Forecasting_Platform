"use client";

import { motion } from "motion/react";
import { Clock, ChefHat, CheckCircle2 } from "lucide-react";

interface Props {
  order: {
    id: string;
    orderNumber: string;
    studentName: string;
    status: string;
    totalAmount: number;
    items: { name: string; quantity: number; price: number }[];
  };
  onStatusChange: (orderId: string, newStatus: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CONFIRMED: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: <Clock className="w-3 h-3" /> },
  IN_PREPARATION: { label: "Preparing", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: <ChefHat className="w-3 h-3" /> },
  READY: { label: "Ready", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  COLLECTED: { label: "Collected", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function OrderQueueCard({ order, onStatusChange }: Props) {
  const cfg = statusConfig[order.status] ?? statusConfig.CONFIRMED;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl p-3"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
            {order.orderNumber}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.color}`}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>
        <span className="text-xs font-bold text-[var(--brand)]">
          Rs.{order.totalAmount.toLocaleString()}
        </span>
      </div>

      {/* Student name */}
      <p className="text-xs text-[var(--text-muted)] mb-1.5">{order.studentName}</p>

      {/* Items */}
      <div className="flex flex-wrap gap-1 mb-2">
        {order.items.map((it, i) => (
          <span
            key={i}
            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-secondary)]"
          >
            {it.name} ×{it.quantity}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      {order.status === "CONFIRMED" && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onStatusChange(order.id, "IN_PREPARATION")}
          className="w-full py-2 rounded-lg text-xs font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors"
        >
          Start Prep
        </motion.button>
      )}
      {order.status === "IN_PREPARATION" && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onStatusChange(order.id, "READY")}
          className="w-full py-2 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
        >
          Mark Ready
        </motion.button>
      )}
    </motion.div>
  );
}
