"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      btn: "bg-red-500 hover:bg-red-600 text-white",
      icon: "text-red-400",
      bg: "bg-red-500/10",
    },
    warning: {
      btn: "bg-amber-500 hover:bg-amber-600 text-black",
      icon: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    default: {
      btn: "bg-[var(--brand)] hover:opacity-90 text-black",
      icon: "text-[var(--brand)]",
      bg: "bg-[var(--brand)]/10",
    },
  };
  const vs = variantStyles[variant];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl p-6"
          style={{
            background: "oklch(0.14 0.012 260)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full ${vs.bg} flex items-center justify-center mb-4`}>
              <AlertTriangle className={`w-6 h-6 ${vs.icon}`} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">{title}</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">{message}</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${vs.btn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
