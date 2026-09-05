"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import DietaryBadge from "@/components/menu/DietaryBadge";
import OrderConfirmationModal from "./OrderConfirmationModal";
import type { CartItem, OrderResult } from "@/types/cart";
import type { PickupSlotData } from "@/types/menu";
import type { OrderMode } from "@/lib/order-mode";
import { sheetVariants, fadeEase, HIT_SLOP } from "@/lib/motion";

interface Props {
  items: CartItem[];
  selectedSlot: PickupSlotData | null;
  orderMode: OrderMode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateQty: (itemId: string, delta: number) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
  isPlacingOrder?: boolean;
  coinsBalance: number;
  coinsToRedeem: number;
  onCoinsChange: (val: number) => void;
  /** When set, the sheet morphs into the confirmation view. */
  confirmedOrder?: OrderResult | null;
  onConfirmationClose?: () => void;
}

export default function CartPanel({ items, selectedSlot, orderMode, isOpen, onClose, onUpdateQty, onRemove, onCheckout, isPlacingOrder = false, coinsBalance, coinsToRedeem, onCoinsChange, confirmedOrder = null, onConfirmationClose }: Props) {
  const total = items.reduce((sum, ci) => sum + (ci.menuItem.specialPrice ?? ci.menuItem.basePrice) * ci.quantity, 0);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="cart-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeEase}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {isOpen && (
        <div key="cart-positioner" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 pointer-events-none">
          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="shown"
            exit="gone"
            className="pointer-events-auto w-full sm:max-w-sm max-h-[92dvh] sm:max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[var(--brand)]" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {confirmedOrder ? "Order Confirmed" : "Your Cart"}
                </h2>
                {!confirmedOrder && <span className="text-xs text-[var(--text-muted)]">({items.length} item{items.length !== 1 ? "s" : ""})</span>}
              </div>
              <motion.button
                onClick={confirmedOrder ? onConfirmationClose : onClose}
                whileTap={{ scale: 0.96 }}
                aria-label="Close cart"
                className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`}
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </motion.button>
            </div>

            {/* Body — cart ↔ confirmation morph */}
            <AnimatePresence mode="wait" initial={false}>
              {confirmedOrder ? (
                <motion.div
                  key="cart-done"
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.98 }}
                  transition={fadeEase}
                  className="flex-1 overflow-y-auto"
                >
                  <OrderConfirmationModal order={confirmedOrder} onBackToMenu={onConfirmationClose ?? onClose} />
                </motion.div>
              ) : (
                <motion.div
                  key="cart-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.98 }}
                  transition={fadeEase}
                  className="flex-1 overflow-y-auto px-5 py-3 space-y-3"
                >
                  {items.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)] text-sm">Your cart is empty</div>
                  ) : (
                    <AnimatePresence initial={false} mode="popLayout">
                      {items.map((ci) => {
                        const price = ci.menuItem.specialPrice ?? ci.menuItem.basePrice;
                        return (
                          <motion.div
                            key={ci.menuItem.id}
                            layout
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24 }}
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <DietaryBadge type={ci.menuItem.dietaryType} />
                                <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">{ci.menuItem.name}</h3>
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">Rs.{price} each</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <motion.button
                                onClick={() => onUpdateQty(ci.menuItem.id, -1)}
                                whileTap={{ scale: 0.96 }}
                                aria-label={`Remove one ${ci.menuItem.name}`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-[var(--text-muted)] ${HIT_SLOP}`}
                              >
                                <Minus className="w-3 h-3" />
                              </motion.button>
                              <span className="text-sm font-medium text-[var(--text-primary)] w-6 text-center">{ci.quantity}</span>
                              <motion.button
                                onClick={() => onUpdateQty(ci.menuItem.id, 1)}
                                disabled={ci.quantity >= 10}
                                whileTap={{ scale: 0.96 }}
                                aria-label={`Add one ${ci.menuItem.name}`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-[var(--text-muted)] disabled:opacity-30 ${HIT_SLOP}`}
                              >
                                <Plus className="w-3 h-3" />
                              </motion.button>
                            </div>
                            <p className="text-sm font-bold text-[var(--brand)] w-16 text-right">Rs.{price * ci.quantity}</p>
                            <motion.button
                              onClick={() => onRemove(ci.menuItem.id)}
                              whileTap={{ scale: 0.96 }}
                              aria-label={`Remove ${ci.menuItem.name} from cart`}
                              className={`ml-1 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 ${HIT_SLOP}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            {!confirmedOrder && items.length > 0 && (
              <div className="border-t border-[rgba(255,255,255,0.07)] px-5 py-4 space-y-3">
                {orderMode.isPreOrder && selectedSlot && (
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Pickup Slot</span>
                    <span className="text-[var(--text-primary)] font-medium">{selectedSlot.displayLabel}</span>
                  </div>
                )}
                {!orderMode.isPreOrder && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-medium">Walk-In Order</span>
                      {orderMode.estimateWait && <span className="text-amber-400/70">Est. wait {orderMode.estimateWait}</span>}
                    </div>
                    <p className="text-[10px] text-amber-400/50">No time slot &middot; {orderMode.coinsInfo}</p>
                  </div>
                )}
                {/* Coins Redemption (Story 4.3) */}
                {coinsBalance >= 10 && (
                  <div className="p-2.5 rounded-xl bg-yellow-500/5 border border-yellow-500/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400">🪙 Redeem Coins ({coinsBalance} available)</span>
                      <span className="text-yellow-400/70">Save LKR {coinsToRedeem}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.min(100, coinsBalance)}
                      step={10}
                      value={coinsToRedeem}
                      onChange={(e) => onCoinsChange(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-yellow-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-disabled)]">
                      <span>0</span>
                      <span>{Math.min(100, coinsBalance)} coins</span>
                    </div>
                  </div>
                )}
                {coinsToRedeem > 0 && (
                  <div className="flex items-center justify-between text-xs text-green-400">
                    <span>You save</span>
                    <span>-Rs.{coinsToRedeem}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Total</span>
                  <span className="text-lg font-bold text-[var(--brand)]">
                    Rs.{total - coinsToRedeem}
                    {coinsToRedeem > 0 && <span className="text-xs text-[var(--text-disabled)] line-through ml-1">Rs.{total}</span>}
                  </span>
                </div>
                <motion.button
                  onClick={onCheckout}
                  disabled={(orderMode.isPreOrder && !selectedSlot) || isPlacingOrder}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-30 transition-opacity"
                  style={{ background: "var(--brand)", color: "#000" }}
                >
                  {isPlacingOrder ? "Placing order…" : orderMode.isPreOrder && !selectedSlot ? "Select a slot to checkout" : orderMode.isPreOrder ? "Confirm Pre-Order" : "Place Walk-In Order"}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
