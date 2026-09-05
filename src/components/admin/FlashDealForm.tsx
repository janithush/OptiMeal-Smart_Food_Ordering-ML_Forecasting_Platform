"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
  currentPrice: number;
}

/**
 * FlashDealForm — Modal for Admin to configure and publish a Flash Deal.
 * Fields: discount % (1–100), expiry time, optional message.
 * Shows live preview of discounted price.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export default function FlashDealForm({
  isOpen,
  onClose,
  menuItemId,
  menuItemName,
  currentPrice,
}: Props) {
  const [discountPercent, setDiscountPercent] = useState(20);
  const [expiresInMinutes, setExpiresInMinutes] = useState(60);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discountedPrice = Math.round(currentPrice * (1 - discountPercent / 100) * 100) / 100;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

      const res = await fetch("/api/admin/flash-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId,
          discountPercent,
          expiresAt,
          message: message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create flash deal");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">Flash Deal</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Create a time-limited discount for <strong>{menuItemName}</strong>
            </p>

            {/* Discount % Slider */}
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Discount Percentage
            </label>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="range"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="text-sm font-bold text-amber-400 w-12 text-right">
                {discountPercent}%
              </span>
            </div>

            {/* Expiry Time */}
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Expires In
            </label>
            <select
              value={expiresInMinutes}
              onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
              className="w-full mb-4 rounded-xl px-3 py-2 text-sm bg-white/5 border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>

            {/* Optional Message */}
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Message (optional)
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Flash Sale! Limited time only"
              className="w-full mb-4 rounded-xl px-3 py-2 text-sm bg-white/5 border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
            />

            {/* Price Preview */}
            <div
              className="rounded-xl p-3 mb-4 flex items-center justify-between"
              style={{ background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.2)" }}
            >
              <span className="text-xs text-[var(--text-muted)]">Discounted Price</span>
              <div className="text-right">
                <span className="text-sm text-[var(--text-disabled)] line-through mr-2">
                  Rs.{currentPrice.toFixed(2)}
                </span>
                <span className="text-base font-bold text-amber-400">
                  Rs.{discountedPrice.toFixed(2)}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, oklch(0.62 0.19 80), oklch(0.55 0.18 80))",
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {saving ? "Publishing..." : "Publish Flash Deal"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
