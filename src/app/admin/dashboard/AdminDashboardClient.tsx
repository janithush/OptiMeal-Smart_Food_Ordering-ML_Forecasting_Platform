"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ShoppingCart, DollarSign, TrendingUp, Package, Users, ClipboardList, Activity, Utensils } from "lucide-react";
import type { DashboardPayload } from "@/lib/order-events";
import KpiCard from "@/components/admin/KpiCard";
import HourlySalesChart from "@/components/admin/HourlySalesChart";
import ItemSalesList from "@/components/admin/ItemSalesList";
import SlotQueueBars from "@/components/admin/SlotQueueBars";

interface Props {
  userName: string;
  initialData: DashboardPayload;
}

export default function AdminDashboardClient({ userName, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // WebSocket connection to /admin namespace
  useEffect(() => {
    let socket: ReturnType<typeof import("socket.io-client").io> | null = null;

    const connect = async () => {
      const { io } = await import("socket.io-client");
      socket = io("/admin", {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        setConnected(true);
        console.log("[admin-dashboard] socket connected");
      });

      socket.on("dashboardUpdate", (payload: DashboardPayload) => {
        setData(payload);
        setLastUpdate(new Date(payload.updatedAt).toLocaleTimeString());
      });

      socket.on("disconnect", () => {
        setConnected(false);
      });

      socket.on("connect_error", (err: Error) => {
        console.warn("[admin-dashboard] socket error:", err.message);
      });
    };

    connect();

    return () => {
      socket?.disconnect();
    };
  }, []);

  // Re-fetch on mount as fallback
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, []);

  // Render
  const preOrderPct = data.totalOrders > 0 ? Math.round((data.preOrderCount / data.totalOrders) * 100) : 0;

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome, {userName}
                {connected && (
                  <span className="ml-2 text-emerald-400">● Live</span>
                )}
                {lastUpdate && (
                  <span className="ml-2 text-[var(--text-disabled)]">Updated {lastUpdate}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin/orders")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Orders
              </button>
              <button
                onClick={() => router.push("/admin/menu")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <Utensils className="w-3.5 h-3.5" />
                Menu
              </button>
              <button
                onClick={refreshData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <Activity className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total Orders"
            value={data.totalOrders}
            subtitle="Today"
            icon={<ShoppingCart className="w-4 h-4 text-blue-400" />}
            glowColor="oklch(0.62 0.19 250)"
          />
          <KpiCard
            label="Revenue"
            value={`Rs.${data.totalRevenue.toLocaleString()}`}
            subtitle="Today"
            icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
            trend={data.totalRevenue > 0 ? "up" : "neutral"}
            glowColor="oklch(0.62 0.19 150)"
          />
          <KpiCard
            label="Pre-Orders"
            value={`${preOrderPct}%`}
            subtitle={`${data.preOrderCount} pre · ${data.walkInCount} walk-in`}
            icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
            glowColor="oklch(0.55 0.20 300)"
          />
          <KpiCard
            label="Active Slots"
            value={data.slotQueueDepths.length}
            subtitle={`${data.slotQueueDepths.reduce((s, sl) => s + sl.depth, 0)} queued`}
            icon={<Users className="w-4 h-4 text-amber-400" />}
            glowColor="oklch(0.62 0.19 80)"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HourlySalesChart data={data.hourlySales} />
          <ItemSalesList items={data.itemsSold} />
        </div>

        {/* Slot Queue Row */}
        <SlotQueueBars slots={data.slotQueueDepths} />
      </div>
    </div>
  );
}
