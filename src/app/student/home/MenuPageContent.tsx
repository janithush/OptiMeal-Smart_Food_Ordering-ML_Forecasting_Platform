"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { springSnappy, fadeEase, listContainer, listItem, HIT_SLOP } from "@/lib/motion";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { useRouter } from "next/navigation";
import { Clock, ShoppingBag, ClipboardList, Timer, Wallet, Coins, BarChart3, Users } from "lucide-react";
import type { MenuItemData, PickupSlotData, DietaryType } from "@/types/menu";
import type { OrderMode } from "@/lib/order-mode";
import type { CartItem, OrderResult } from "@/types/cart";
import MenuItemCard from "@/components/menu/MenuItemCard";
import MenuItemDetail from "@/components/menu/MenuItemDetail";
import CartPanel from "@/components/cart/CartPanel";
import MyUsualSection from "@/components/menu/MyUsualSection";
import RecommendedSection from "@/components/menu/RecommendedSection";
import type { MyUsualCombo } from "@/lib/my-usual";
import type { RecommendedItem } from "@/lib/recommendations";
import OrderStatusToast from "@/components/notifications/OrderStatusToast";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { showNotification } from "@/lib/notifications";
import type { OrderStatusPayload } from "@/lib/order-events";
import FlashDealBanner from "@/components/menu/FlashDealBanner";
import { useFlashDeals } from "@/hooks/useFlashDeals";

interface Props {
  userName: string;
  items: MenuItemData[];
  slots: PickupSlotData[];
  userDietary: DietaryType | null;
  orderMode: OrderMode;
  walletBalance: number;
  coinsBalance: number;
  myUsual: MyUsualCombo[];
  recommendations: RecommendedItem[];
}

type FilterValue = "All" | DietaryType;

const filterChips: { value: FilterValue; label: string }[] = [
  { value: "All", label: "All" },
  { value: "VEGAN", label: "Vegan 🌱" },
  { value: "VEGETARIAN", label: "Vegetarian 🥬" },
  { value: "NON_VEGETARIAN", label: "Non-Veg 🍗" },
];

export default function MenuPageContent({ userName, items, slots, userDietary, orderMode, walletBalance: initialBalance, coinsBalance: initialCoins, myUsual, recommendations }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>(userDietary ?? "All");
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderResult | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [toastUpdate, setToastUpdate] = useState<OrderStatusPayload | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const prevUpdateRef = useRef<string | null>(null);
  const [displayBalance, setDisplayBalance] = useState(initialBalance);
  const [displayCoins, setDisplayCoins] = useState(initialCoins);
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  // Double-tap prevention: sync ref guard + UI state. The idempotency key
  // is reused across retries of the same cart so double submits dedupe server-side.
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const placingRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);

  // Socket.io — real-time order status
  const { lastUpdate } = useOrderSocket();

  // Story 6.4: Flash Deals
  const { deals, removeDeal } = useFlashDeals();
  const handleFlashDealOrder = (menuItemId: string) => {
    const item = items.find((mi) => mi.id === menuItemId);
    if (item) setSelectedItem(item);
  };

  const [activeFlashDealId, setActiveFlashDealId] = useState<string | null>(null);

  useEffect(() => {
    if (lastUpdate && lastUpdate.timestamp !== prevUpdateRef.current) {
      prevUpdateRef.current = lastUpdate.timestamp;
      setToastUpdate(lastUpdate);

      // Browser push notification
      const statusLabel: Record<string, string> = {
        IN_PREPARATION: "being prepared",
        READY: "ready for pickup",
        COLLECTED: "collected",
      };
      showNotification(
        `${lastUpdate.orderNumber} — Order Update`,
        `Your order is now ${statusLabel[lastUpdate.status] ?? lastUpdate.status}${lastUpdate.slotDisplay ? ` · ${lastUpdate.slotDisplay}` : ""}`
      );
    }
  }, [lastUpdate]);

  const available = items.filter((i) => i.availability !== "Sold Out").length;
  const soldOut = items.filter((i) => i.availability === "Sold Out").length;

  const filteredItems = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((i) => i.dietaryType === filter);
  }, [items, filter]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  // ─── Recommendations add-to-cart handler ─────────────────────
  const handleRecommendAdd = (rec: RecommendedItem) => {
    const menuItem = items.find((mi) => mi.id === rec.menuItemId);
    if (!menuItem) return;
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === rec.menuItemId);
      if (existing) {
        if (existing.quantity >= 10) return prev;
        return prev.map((ci) =>
          ci.menuItem.id === rec.menuItemId
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
    setToastMessage(`Added ${rec.name} to cart`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ─── My Usual reorder handler ─────────────────────────────────
  const handleReorder = (combo: MyUsualCombo) => {
    const newCartItems: CartItem[] = combo.items.map((ci) => {
      const menuItem = items.find((mi) => mi.id === ci.menuItemId);
      if (!menuItem) return null;
      return { menuItem, quantity: ci.quantity };
    }).filter((c): c is CartItem => c !== null);

    setCart((prev) => {
      const merged = [...prev];
      for (const nc of newCartItems) {
        const existing = merged.find((c) => c.menuItem.id === nc.menuItem.id);
        if (existing) {
          existing.quantity = Math.min(10, existing.quantity + nc.quantity);
        } else {
          merged.push(nc);
        }
      }
      return merged;
    });
    setCartOpen(true);
    setToastMessage(`Added ${combo.label} to cart`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ─── Cart handlers ──────────────────────────────────────────────
  const addToCart = (item: MenuItemData, _slotId: string | null) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        if (existing.quantity >= 10) return prev;
        return prev.map((ci) => (ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => (ci.menuItem.id === itemId ? { ...ci, quantity: ci.quantity + delta } : ci))
        .filter((ci) => ci.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const clearCart = () => setCart([]);

  // ─── Checkout ───────────────────────────────────────────────────
  const handleCheckout = async () => {
    // Double-tap prevention: ignore re-entrant clicks.
    if (placingRef.current) return;
    placingRef.current = true;
    setIsPlacingOrder(true);
    setCheckoutError(null);
    // Reuse one idempotency key per cart attempt so retries dedupe.
    if (!idempotencyRef.current) {
      idempotencyRef.current = crypto.randomUUID();
    }
    const body: Record<string, unknown> = {
      // Prices are re-computed server-side; client sends IDs + quantities only.
      items: cart.map((ci) => ({
        menuItemId: ci.menuItem.id,
        quantity: ci.quantity,
      })),
      coinsRedeemed: coinsToRedeem,
      pickupSlotId: orderMode.isPreOrder ? selectedSlotId : null,
      orderType: orderMode.isPreOrder ? "PRE_ORDER" : "WALK_IN",
      idempotencyKey: idempotencyRef.current,
    };

    // Story 6.4: Pass flash deal ID if active
    if (activeFlashDealId) {
      body.flashDealId = activeFlashDealId;
    }

    try {
      const res = await fetch("/api/student/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Validation errors (400) mean the cart payload is stale — issue a
        // fresh key next attempt. Network errors keep the key for safe retry.
        if (res.status === 400) idempotencyRef.current = null;
        setCheckoutError(data.error ?? "Order failed");
        return;
      setDisplayCoins((prev) => prev - coinsToRedeem + (data.type === "PRE_ORDER" ? 0 : 0));
      setCoinsToRedeem(0);
      }
      idempotencyRef.current = null;
      setConfirmedOrder(data);
      setDisplayBalance((prev) => prev - data.totalAmount);
      clearCart();
      // Keep the sheet open — it morphs into the confirmation view.
      setCartOpen(true);
    } catch {
      setCheckoutError("Network error — please try again");
    } finally {
      placingRef.current = false;
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Real-time order status toast (Story 3.5) */}
      <OrderStatusToast update={toastUpdate} />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Today&apos;s Menu</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome, {userName} · {available} available · {soldOut} sold out
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* My Orders Button */}
              <button onClick={() => router.push("/student/orders")} className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`} title="My Orders" aria-label="My Orders">
                <ClipboardList className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              {/* Cart Button */}
              <button onClick={() => setCartOpen(true)} className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`} aria-label="Open cart">
                <ShoppingBag className="w-5 h-5 text-[var(--text-secondary)]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
              {/* Group Order Button (Story 5.4) */}
              <button onClick={() => router.push("/student/group-order")} className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-purple-500/10 hover:bg-purple-500/15 transition-colors ${HIT_SLOP}`} title="Group Order" aria-label="Group Order">
                <Users className="w-5 h-5 text-purple-400" />
              </button>
              {/* Analytics Button */}
              <button onClick={() => router.push("/student/analytics")} className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`} title="Analytics" aria-label="Analytics">
                <BarChart3 className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              {/* Wallet Balance Pill (Story 4.1) */}
              <button onClick={() => router.push("/student/wallet")} className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`} title="View Wallet">
                <Wallet className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span className="text-xs font-bold text-[var(--brand)]">Rs.{displayBalance.toLocaleString()}</span>
              </button>
              {/* Coins Pill (Story 4.3) */}
              <button onClick={() => router.push("/student/rewards")} className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 hover:bg-yellow-500/15 transition-colors ${HIT_SLOP}`} title="View Rewards">
                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">{displayCoins}</span>
              </button>
              {/* Theme Toggle */}
              <ThemeToggle />
              <a
                href="/student/profile"
                className={`w-9 h-9 rounded-full overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] text-sm font-bold hover:border-[var(--brand)] transition-colors ${HIT_SLOP}`}
              >
                {userName.charAt(0).toUpperCase()}
              </a>
            </div>
          </div>

          {/* Order Mode Banner (Story 3.6 — enhanced) */}
          <div
            className={`mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
              orderMode.isPreOrder
                ? "bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {orderMode.isPreOrder ? <Clock className="w-3.5 h-3.5 shrink-0" /> : <Timer className="w-3.5 h-3.5 shrink-0" />}
            <span>
              {orderMode.message}
              {orderMode.estimateWait && <> &middot; Est. wait {orderMode.estimateWait}</>}
              {!orderMode.isPreOrder && <> &middot; {orderMode.coinsInfo}</>}
            </span>
          </div>

          {/* Filter Chips — active pill glides via layoutId */}
          <LayoutGroup id="menu-filters">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {filterChips.map((chip) => {
                const active = filter === chip.value;
                return (
                  <motion.button
                    key={chip.value}
                    onClick={() => setFilter(chip.value)}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={active}
                    className={`relative shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${HIT_SLOP} ${
                      active
                        ? "text-[var(--brand)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="menu-filter-pill"
                        transition={springSnappy}
                        className="absolute inset-0 rounded-lg bg-[var(--brand)]/20 border border-[var(--brand)]/30"
                      />
                    )}
                    <span className="relative z-10">{chip.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </div>

      {/* Reorder Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="reorder-toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fadeEase}
            className="max-w-lg mx-auto px-4 pt-3"
          >
            <div className="p-3 rounded-xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 text-[var(--brand)] text-sm">
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Error */}
      {checkoutError && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex justify-between items-center">
            {checkoutError}
            <button onClick={() => setCheckoutError(null)} className="text-red-400/60 hover:text-red-400 ml-2">✕</button>
          </div>
        </div>
      )}

      {/* Flash Deal Banners (Story 6.4) */}
      <div className="max-w-lg mx-auto px-4">
        <AnimatePresence>
          {deals.map((deal) => (
            <FlashDealBanner
              key={deal.id}
              deal={deal}
              onOrderNow={handleFlashDealOrder}
              onExpired={removeDeal}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* My Usual Section (Story 5.2) */}
      <MyUsualSection combos={myUsual} onReorder={handleReorder} />

      {/* Recommended for You (Story 5.3) */}
      <RecommendedSection items={recommendations} onAddToCart={handleRecommendAdd} />

      {/* Menu Grid */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-muted)] text-sm">
              {filter === "All"
                ? "No menu items available today. Check back later!"
                : `No ${filter.toLowerCase().replace("_", " ")} items today.`}
            </p>
            {filter !== "All" && (
              <button onClick={() => setFilter("All")} className="mt-3 text-sm text-[var(--brand)] hover:underline">
                Show all items
              </button>
            )}
          </div>
        ) : (
          <motion.div layout variants={listContainer} initial="hidden" animate="shown" className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  variants={listItem}
                  exit="gone"
                >
                  <MenuItemCard item={item} onTap={(itm) => { setSelectedSlotId(null); setSelectedItem(itm); }} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Selected slot indicator */}
      {selectedSlot && orderMode.isPreOrder && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-[var(--brand)]/20 border border-[var(--brand)]/30 text-[var(--brand)] text-xs font-medium shadow-[var(--shadow-glow)]">
          🕐 Selected slot: {selectedSlot.displayLabel}
        </div>
      )}

      {/* Item Detail Sheet — always mounted so exit plays */}
      <MenuItemDetail
        item={selectedItem}
        slots={slots}
        selectedSlotId={selectedSlotId}
        orderMode={orderMode}
        onClose={() => setSelectedItem(null)}
        onSlotSelect={setSelectedSlotId}
        onAddToCart={(slotId) => {
          if (!selectedItem) return;
          addToCart(selectedItem, slotId);
          setSelectedItem(null);
        }}
      />

      {/* Cart Panel — morphs into confirmation after checkout */}
      <CartPanel
        items={cart}
        selectedSlot={selectedSlot ?? null}
        orderMode={orderMode}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateQuantity}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
        isPlacingOrder={isPlacingOrder}
        coinsBalance={displayCoins}
        coinsToRedeem={coinsToRedeem}
        onCoinsChange={setCoinsToRedeem}
        confirmedOrder={confirmedOrder}
        onConfirmationClose={() => {
          setConfirmedOrder(null);
          setSelectedSlotId(null);
          setCartOpen(false);
        }}
      />
    </div>
  );
}
