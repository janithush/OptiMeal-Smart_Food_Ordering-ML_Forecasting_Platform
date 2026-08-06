"use client";

import { useState, useEffect } from "react";
import { ClipboardList, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import OrderDetail from "@/components/orders/OrderDetail";
import { useOrderSocket } from "@/hooks/useOrderSocket";

interface OrderItemData {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  totalAmount: number;
  qrCode: string;
  pickupSlot?: { slotTime: string; displayLabel?: string } | null;
  items: OrderItemData[];
  createdAt: string;
}

interface Props {
  orders: OrderData[];
}

export default function OrdersPageContent({ orders: initialOrders }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Socket.io — register handler via onUpdate callback (stable, no effect needed)
  const { onUpdate } = useOrderSocket();

  useEffect(() => {
    const handler = (payload: { orderId: string; status: string }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === payload.orderId ? { ...o, status: payload.status } : o
        )
      );
    };
    onUpdate(handler);
  }, [onUpdate]);

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push("/student/home")} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Orders</h1>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
              <ClipboardList className="w-8 h-8 text-[var(--text-disabled)]" />
            </div>
            <p className="text-[var(--text-muted)] text-sm">No orders yet — start by browsing the menu!</p>
            <button onClick={() => router.push("/student/home")} className="mt-3 text-sm text-[var(--brand)] hover:underline">
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderDetail
                key={order.id}
                order={order}
                isExpanded={expandedId === order.id}
                onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
