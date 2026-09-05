"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, QrCode, Loader2, Package } from "lucide-react";
import OrderQueueCard from "@/components/admin/OrderQueueCard";
import QRScanner from "@/components/admin/QRScanner";

interface Props {
  userName: string;
}

interface QueueOrder {
  id: string;
  orderNumber: string;
  studentName: string;
  status: string;
  totalAmount: number;
  type: string;
  qrCode: string;
  items: { name: string; quantity: number; price: number }[];
  createdAt: string;
}

interface SlotGroup {
  slotTime: string;
  count: number;
  orders: QueueOrder[];
}

export default function AdminOrdersClient({ userName }: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotGroup[]>([]);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/queue");
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
        if (!activeSlot && data.slots?.length > 0) {
          // Select first non-empty slot, or first slot
          const first = data.slots.find((s: SlotGroup) => s.orders.length > 0) ?? data.slots[0];
          setActiveSlot(first?.slotTime ?? null);
        }
      }
    } catch { /* ignore */ }
  }, [activeSlot]);

  // Initial fetch (in async IIFE so setLoading sits behind an `await`).
  useEffect(() => {
    (async () => {
      await fetchQueue();
      setLoading(false);
    })();
    // fetchQueue is intentionally omitted from deps — it depends on
    // `activeSlot` and we only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for updates every 5s — re-runs when fetchQueue's identity changes
  // (i.e. when activeSlot flips), which is the desired behavior.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (res.ok) {
        // Optimistic update
        setSlots((prev) =>
          prev.map((s) => ({
            ...s,
            orders: s.orders.map((o) =>
              o.id === orderId ? { ...o, status: newStatus } : o
            ),
          }))
        );
        // Also remove if collected
        if (newStatus === "COLLECTED") {
          setTimeout(fetchQueue, 500);
        }
      }
    } catch { /* ignore */ }
  };

  const handleQRScan = async (qrCode: string) => {
    const res = await fetch("/api/admin/orders/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode }),
    });
    const data = await res.json();
    if (res.ok) {
      fetchQueue();
      return { success: true, orderNumber: data.orderNumber, studentName: data.studentName };
    }
    return { success: false, error: data.error ?? "Scan failed" };
  };

  const activeGroup = slots.find((s) => s.slotTime === activeSlot);
  const totalPending = slots.reduce((sum, s) => sum + s.orders.length, 0);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/admin/dashboard")} className="p-1">
                <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Order Queue</h1>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalPending} pending · {slots.length} slots
                </p>
              </div>
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand)]/15 hover:bg-[var(--brand)]/25 text-[var(--brand)] transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Scan QR
            </button>
          </div>

          {/* Slot tabs */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {slots.map((slot) => (
              <button
                key={slot.slotTime}
                onClick={() => setActiveSlot(slot.slotTime)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeSlot === slot.slotTime
                    ? "bg-[var(--brand)]/20 text-[var(--brand)] border border-[var(--brand)]/30"
                    : "bg-white/5 text-[var(--text-muted)] border border-transparent hover:border-white/10"
                }`}
              >
                {slot.slotTime}
                {slot.count > 0 && (
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                    activeSlot === slot.slotTime
                      ? "bg-[var(--brand)]/30 text-[var(--brand)]"
                      : "bg-white/10 text-[var(--text-disabled)]"
                  }`}>
                    {slot.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order list */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
          </div>
        ) : !activeGroup || activeGroup.orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-10 h-10 text-[var(--text-disabled)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No pending orders for this slot</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1">
              {activeGroup ? `${activeGroup.slotTime} is clear` : "Select a slot above"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {activeGroup.orders.map((order) => (
                <OrderQueueCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* QR Scanner Modal — conditionally mounted so it remounts fresh on each open,
          letting the child reset its own state without a setState-in-effect. */}
      {scannerOpen && (
        <QRScanner
          onClose={() => setScannerOpen(false)}
          onScan={handleQRScan}
        />
      )}
    </div>
  );
}
