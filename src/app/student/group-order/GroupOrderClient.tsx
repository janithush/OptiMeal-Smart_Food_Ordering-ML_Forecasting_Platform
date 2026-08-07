"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Timer, Loader2, Copy, Check, ShoppingBag } from "lucide-react";
import CreateJoinGroup from "@/components/orders/CreateJoinGroup";
import GroupOrderParticipants from "@/components/orders/GroupOrderParticipants";
import GroupOrderCart from "@/components/orders/GroupOrderCart";
import type { GroupOrderData, GroupOrderCheckoutResult } from "@/types/group-order";
import type { MenuItemData, PickupSlotData } from "@/types/menu";

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
}

export default function GroupOrderClient({ userId, userName }: Props) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupOrderData | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<GroupOrderCheckoutResult | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [slots, setSlots] = useState<PickupSlotData[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetch("/api/student/group-orders/init")
      .then((r) => r.json())
      .then((data) => {
        if (data.menuItems) setMenuItems(data.menuItems);
        if (data.slots) setSlots(data.slots);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll for group updates
  const refreshGroup = useCallback(async () => {
    if (!group) return;
    try {
      const res = await fetch(`/api/student/group-orders/${group.id}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch { /* ignore */ }
  }, [group]);

  useEffect(() => {
    if (!group || group.status !== "OPEN") return;
    const interval = setInterval(refreshGroup, 3000);
    return () => clearInterval(interval);
  }, [group, refreshGroup]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleAddItem = async (menuItemId: string) => {
    if (!group) return;
    try {
      const res = await fetch(`/api/student/group-orders/${group.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, quantity: 1 }),
      });
      if (res.ok) setGroup(await res.json());
    } catch { /* ignore */ }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!group) return;
    try {
      const res = await fetch(`/api/student/group-orders/${group.id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) setGroup(await res.json());
    } catch { /* ignore */ }
  };

  const handleCheckout = async () => {
    if (!group || !selectedSlotId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/group-orders/${group.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupSlotId: selectedSlotId, coinsRedeemed: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      setCheckoutResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render: Checkout Result ──────────────────────────────────────
  if (checkoutResult) {
    return (
      <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
        <div className="max-w-lg mx-auto px-4 pt-12 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
          >
            <ShoppingBag className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Group Order Confirmed!</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Total: <span className="text-[var(--brand)] font-bold">Rs.{checkoutResult.totalAmount.toLocaleString()}</span>
          </p>

          {/* QR Code placeholder */}
          <div className="w-48 h-48 bg-white rounded-xl p-3 mb-4 mx-auto">
            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-500">QR: {checkoutResult.qrCode}</span>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-disabled)] mb-6">
            Slot: {checkoutResult.pickupSlot?.displayLabel ?? "N/A"}
          </p>

          <div className="space-y-2 w-full max-w-xs">
            {checkoutResult.orders.map((o) => (
              <div
                key={o.orderId}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5"
              >
                <span className="text-xs text-[var(--text-primary)]">{o.studentName}</span>
                <span className="text-xs text-[var(--text-muted)]">#{o.orderNumber} · {o.itemCount} items</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/student/home")}
            className="mt-8 px-6 py-3 rounded-xl bg-[var(--brand)] text-black text-sm font-bold"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.08_0.01_260)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // ─── Render: No group yet → create/join ─────────────────────────
  if (!group) {
    return (
      <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
        <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => router.push("/student/home")} className="p-1">
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Group Order</h1>
          </div>
        </div>
        <CreateJoinGroup
          onCreated={setGroup}
          onJoined={setGroup}
        />
      </div>
    );
  }

  // ─── Render: Active Group ────────────────────────────────────────
  const isOrganiser = group.organizerId === userId;
  const isExpired = group.status === "EXPIRED" || group.status === "CONFIRMED";
  const cartTotal = group.cartItems.reduce((s, i) => s + i.basePrice * i.quantity, 0);
  const expiryTime = new Date(group.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/student/home")} className="p-1">
                <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Group Order</h1>
            </div>
            {/* Share code */}
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
            >
              <span className="text-sm font-mono font-bold tracking-widest text-purple-400">{group.code}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
            </button>
          </div>

          {/* Expiry + Status */}
          <div className="flex items-center gap-3 mb-2">
            {isExpired ? (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                {group.status === "EXPIRED" ? "Expired" : "Ordered"}
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Timer className="w-3 h-3" />
                Expires at {expiryTime}
              </div>
            )}
            <GroupOrderParticipants participants={group.participants} organizerId={group.organizerId} />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 mb-2">{error}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Shared Cart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Shared Cart</h2>
            <span className="text-xs text-[var(--text-muted)]">{group.cartItems.length} items</span>
          </div>
          <GroupOrderCart
            items={group.cartItems}
            currentUserId={userId}
            onRemove={handleRemoveItem}
          />
        </div>

        {/* Menu Items (non-organiser can add) */}
        {!isExpired && menuItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Add Items</h2>
            <div className="space-y-2">
              {menuItems
                .filter((mi) => mi.availability !== "Sold Out")
                .map((item) => (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAddItem(item.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/5"
                    style={{ border: "1px solid var(--glass-border)" }}
                  >
                    <span className="text-xs font-medium text-[var(--text-primary)]">{item.name}</span>
                    <span className="text-xs font-bold text-[var(--brand)]">+ Rs.{item.specialPrice ?? item.basePrice}</span>
                  </motion.button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Slot Selector + Checkout (organiser only) */}
      {isOrganiser && !isExpired && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[oklch(0.08_0.01_260)]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.07)] px-4 py-4">
          <div className="max-w-lg mx-auto">
            {/* Slot selector */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  disabled={slot.currentCount >= slot.maxCapacity}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedSlotId === slot.id
                      ? "bg-[var(--brand)]/20 text-[var(--brand)] border border-[var(--brand)]/30"
                      : slot.currentCount >= slot.maxCapacity
                        ? "bg-white/5 text-[var(--text-disabled)] border border-transparent line-through"
                        : "bg-white/5 text-[var(--text-muted)] border border-transparent hover:border-white/10"
                  }`}
                >
                  {slot.displayLabel}
                </button>
              ))}
            </div>

            {/* Checkout */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">
                Total: <span className="text-[var(--brand)] font-bold">Rs.{cartTotal.toLocaleString()}</span>
              </span>
              <button
                onClick={handleCheckout}
                disabled={!selectedSlotId || group.cartItems.length === 0 || loading}
                className="px-6 py-2.5 rounded-xl bg-[var(--brand)] text-black text-sm font-bold disabled:opacity-40 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
