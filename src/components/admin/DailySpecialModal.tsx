"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Tag } from "lucide-react";

interface Props {
  isOpen: boolean;
  itemName: string;
  basePrice: number;
  onConfirm: (specialPrice: number) => void;
  onCancel: () => void;
}

export default function DailySpecialModal({
  isOpen,
  itemName,
  basePrice,
  onConfirm,
  onCancel,
}: Props) {
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const num = Number(price);
    if (!num || num <= 0) {
      setError("Please enter a valid price");
      return;
    }
    if (num >= basePrice) {
      setError(`Special price must be less than regular price (Rs.${basePrice})`);
      return;
    }
    onConfirm(num);
  };

  if (!isOpen) return null;

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
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Tag className="w-4 h-4 text-purple-400" />
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Daily Special</h2>
            </div>
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/5">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          <p className="text-sm text-[var(--text-muted)] mb-4">
            Set a special discounted price for <span className="text-[var(--text-primary)] font-medium">{itemName}</span>
          </p>

          {/* Regular price reference */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 mb-3">
            <span className="text-xs text-[var(--text-muted)]">Regular Price</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">Rs.{basePrice}</span>
          </div>

          {/* Special price input */}
          <div className="mb-1">
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Special Price (Rs.)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder={`Less than Rs.${basePrice}`}
              min={1}
              max={basePrice - 1}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-purple-500 hover:bg-purple-600 text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Set Special
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
