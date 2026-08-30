"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export interface FlashDealBannerData {
  id: string;
  menuItemId: string;
  menuItemName: string;
  dietaryType: string;
  imageUrl: string | null;
  basePrice: number;
  discountPercent: number;
  discountedPrice: number;
  message: string | null;
  expiresAt: string;
}

interface Props {
  deal: FlashDealBannerData;
  onOrderNow: (menuItemId: string) => void;
  onExpired: (dealId: string) => void;
}

function formatTimeLeft(expiresAt: string, now: number): string {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

/**
 * FlashDealBanner — Student-facing animated banner showing an active
 * Flash Deal with countdown timer, discounted price, and "Order Now" CTA.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export default function FlashDealBanner({ deal, onOrderNow, onExpired }: Props) {
  // Store "now" in state updated by the interval effect so the render
  // body never calls Date.now() (which would violate react-hooks/purity).
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timeLeft, setTimeLeft] = useState<string>(
    () => formatTimeLeft(deal.expiresAt, Date.now())
  );
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNowMs(t);
      const diff = new Date(deal.expiresAt).getTime() - t;
      if (diff <= 0) {
        setIsExpired(true);
        onExpired(deal.id);
        return;
      }
      setTimeLeft(formatTimeLeft(deal.expiresAt, t));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deal.expiresAt, deal.id, onExpired]);

  if (isExpired) return null;

  // Derive isUrgent from state captured by the interval callback, not
  // from a fresh Date.now() during render.
  const isUrgent = new Date(deal.expiresAt).getTime() - nowMs < 5 * 60 * 1000;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -16, height: 0 }}
        className="relative overflow-hidden rounded-2xl mb-4"
        style={{
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(251, 146, 60, 0.08))",
          border: "1px solid rgba(251, 191, 36, 0.3)",
        }}
      >
        {/* Pulsing glow */}
        {isUrgent && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-2xl"
            style={{ background: "rgba(251, 191, 36, 0.06)" }}
          />
        )}

        <div className="relative p-4">
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 3 }}
              className="w-5 h-5 rounded-md bg-amber-400/20 flex items-center justify-center"
            >
              <Zap className="w-3 h-3 text-amber-400" />
            </motion.div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Flash Deal
            </span>
            {deal.message && (
              <span className="text-[11px] text-amber-300/70">
                — {deal.message}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {deal.menuItemName}
          </h3>

          <div className="flex items-center justify-between mt-2">
            {/* Price section */}
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-amber-400">
                Rs.{deal.discountedPrice.toFixed(2)}
              </span>
              <span className="text-xs text-[var(--text-disabled)] line-through">
                Rs.{deal.basePrice.toFixed(2)}
              </span>
              <span className="text-[11px] font-semibold text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded-md">
                -{deal.discountPercent}%
              </span>
            </div>

            {/* Countdown + CTA */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <Clock className={`w-3 h-3 ${isUrgent ? "text-red-400" : "text-amber-400"}`} />
                <span className={isUrgent ? "text-red-400 font-medium" : "text-amber-400"}>
                  {timeLeft}
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onOrderNow(deal.menuItemId)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, oklch(0.62 0.19 80), oklch(0.55 0.18 80))",
                }}
              >
                Order Now
                <ArrowRight className="w-3 h-3" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
