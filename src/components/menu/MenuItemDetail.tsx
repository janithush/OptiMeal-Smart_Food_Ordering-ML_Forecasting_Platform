"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, AlertTriangle } from "lucide-react";
import type { MenuItemData, PickupSlotData } from "@/types/menu";
import type { OrderMode } from "@/lib/order-mode";
import DietaryBadge from "./DietaryBadge";
import AvailabilityBadge from "./AvailabilityBadge";
import { sheetVariants, fadeEase, springSnappy, HIT_SLOP } from "@/lib/motion";

interface Props {
  /** Null = closed. Kept mounted so AnimatePresence exit plays. */
  item: MenuItemData | null;
  slots: PickupSlotData[];
  selectedSlotId: string | null;
  orderMode: OrderMode;
  onClose: () => void;
  onSlotSelect: (slotId: string) => void;
  onAddToCart?: (slotId: string | null) => void;
}

export default function MenuItemDetail({ item, slots, selectedSlotId, orderMode, onClose, onSlotSelect, onAddToCart }: Props) {
  return (
    <AnimatePresence mode="wait">
      {item !== null && (
        <motion.div
          key="detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeEase}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {item !== null && (
        <DetailSheet
          key={item.id}
          item={item}
          slots={slots}
          selectedSlotId={selectedSlotId}
          orderMode={orderMode}
          onClose={onClose}
          onSlotSelect={onSlotSelect}
          onAddToCart={onAddToCart}
        />
      )}
    </AnimatePresence>
  );
}

function DetailSheet({ item, slots, selectedSlotId, orderMode, onClose, onSlotSelect, onAddToCart }: Omit<Props, "item"> & { item: MenuItemData }) {
  const hasSpecial = item.specialPrice !== null && item.specialPrice < item.basePrice;
  const isSoldOut = item.availability === "Sold Out";
  const showSlots = orderMode.isPreOrder && !isSoldOut;

  const initials = item.name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 pointer-events-none">
      <motion.div
        variants={sheetVariants}
        initial="hidden"
        animate="shown"
        exit="gone"
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl relative"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
        }}
      >
        {/* Close button */}
        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.96 }}
          aria-label="Close details"
          className={`absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors ${HIT_SLOP}`}
        >
          <X className="w-4 h-4 text-[var(--text-muted)]" />
        </motion.button>

        {/* Image */}
        <div className="relative h-48 overflow-hidden">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, oklch(0.15 0.02 260), oklch(0.1 0.01 260))`,
              }}
            >
              <span className="text-6xl font-bold text-white/10">{initials}</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Title + Price */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{item.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <DietaryBadge type={item.dietaryType} />
                <AvailabilityBadge status={item.availability} />
              </div>
            </div>
            <div className="text-right">
              {hasSpecial && (
                <span className="text-sm text-[var(--text-disabled)] line-through block">Rs.{item.basePrice}</span>
              )}
              <span className="text-xl font-bold text-[var(--brand)]">Rs.{hasSpecial ? item.specialPrice : item.basePrice}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-[var(--text-secondary)]">{item.description ?? "No description available."}</p>
          </div>

          {/* Ingredients */}
          <div>
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Ingredients</h3>
            {item.ingredients.length > 0 ? (
              <ul className="space-y-1">
                {item.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
                    {ing.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-disabled)] italic">Ingredients coming soon</p>
            )}
          </div>

          {/* Allergens */}
          {item.allergenMatch.length > 0 && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Allergen Warning</p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  This item may contain: {item.allergenMatch.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Pickup Slots — selectable (Story 3.2) */}
          {showSlots && (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Select Pickup Slot — Today
              </h3>
              <div className="space-y-2">
                {slots.map((slot) => {
                  const remaining = slot.maxCapacity - slot.currentCount;
                  const isFull = remaining <= 0;
                  const isSelected = selectedSlotId === slot.id;
                  const pct = remaining / slot.maxCapacity;
                  const barColor =
                    pct <= 0.2 ? "rgb(248,113,113)" : pct <= 0.5 ? "rgb(250,204,21)" : "rgb(74,222,128)";

                  return (
                    <motion.button
                      key={slot.id}
                      disabled={isFull}
                      onClick={() => onSlotSelect(slot.id)}
                      whileTap={isFull ? undefined : { scale: 0.96 }}
                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl ${
                        isFull ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                      }`}
                      style={{
                        background: isSelected ? "var(--brand)/10" : "rgba(255,255,255,0.03)",
                        border: isSelected ? "1px solid var(--brand)" : "1px solid var(--glass-border)",
                      }}
                    >
                      <Clock className={`w-4 h-4 shrink-0 ${isSelected ? "text-[var(--brand)]" : "text-[var(--text-muted)]"}`} />
                      <span className={`text-sm min-w-[110px] ${isSelected ? "text-[var(--brand)] font-medium" : "text-[var(--text-primary)]"}`}>
                        {slot.displayLabel}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ width: `${Math.round(pct * 100)}%` }}
                          transition={springSnappy}
                          className="h-full rounded-full"
                          style={{ background: barColor }}
                        />
                      </div>
                      <span className={`text-xs min-w-[60px] text-right ${isFull ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                        {isFull ? "Full" : `${remaining}/${slot.maxCapacity}`}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Walk-In Mode Notice (Story 3.6 — enhanced) */}
          {!orderMode.isPreOrder && !isSoldOut && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-center space-y-1">
              <p className="text-amber-400">Walk-In Mode — no time slot &middot; {orderMode.coinsInfo}</p>
              {orderMode.estimateWait && <p className="text-amber-400/70">Estimated wait: {orderMode.estimateWait}</p>}
            </div>
          )}

          {/* Coins Note for Walk-In (always visible when walk-in + not sold out) */}
          {!orderMode.isPreOrder && !isSoldOut && (
            <p className="text-center text-[11px] text-amber-400/60">⚠️ Walk-in orders earn 0 Canteen Coins</p>
          )}

          {/* Add to Cart */}
          <motion.button
            onClick={() => onAddToCart?.(selectedSlotId)}
            disabled={isSoldOut || (orderMode.isPreOrder && !selectedSlotId)}
            whileTap={{ scale: 0.96 }}
            className="w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--brand)", color: "#000" }}
          >
            {isSoldOut
              ? "Sold Out"
              : orderMode.isPreOrder && !selectedSlotId
              ? "Select a pickup slot to continue"
              : `Add to Cart — Rs.${hasSpecial ? item.specialPrice : item.basePrice}${!orderMode.isPreOrder ? " (Walk-In)" : ""}`}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
