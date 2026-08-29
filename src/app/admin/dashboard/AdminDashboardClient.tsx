"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ShoppingCart, DollarSign, TrendingUp, Package, Users, ClipboardList, Activity, Utensils, Boxes, ClipboardCheck, BarChart3, Settings } from "lucide-react";
import type { DashboardPayload } from "@/lib/order-events";
import KpiCard from "@/components/admin/KpiCard";
import HourlySalesChart from "@/components/admin/HourlySalesChart";
import ItemSalesList from "@/components/admin/ItemSalesList";
import SlotQueueBars from "@/components/admin/SlotQueueBars";
import SmartDiscountAlert from "@/components/admin/SmartDiscountAlert";
import ActiveFlashDeals from "@/components/admin/ActiveFlashDeals";
import FlashDealForm from "@/components/admin/FlashDealForm";
import ProcurementAlertCard from "@/components/admin/ProcurementAlertCard";
import MlHealthIndicator from "@/components/admin/MlHealthIndicator";
import type { ProcurementAlertPayload } from "@/components/admin/ProcurementAlertCard";
import type { SmartDiscountAlertPayload } from "@/lib/order-events";
import { Zap, AlertTriangle, ShoppingBag, Check } from "lucide-react";

interface Props {
  userName: string;
  initialData: DashboardPayload;
}

export default function AdminDashboardClient({ userName, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Story 6.4: Smart Discount alerts + Flash Deal form
  const [discountAlerts, setDiscountAlerts] = useState<SmartDiscountAlertPayload[]>([]);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [dealTarget, setDealTarget] = useState<{ menuItemId: string; name: string; price: number } | null>(null);
  const [dealsRefreshKey, setDealsRefreshKey] = useState(0);

  // Story 7.2: Procurement alerts state
  const [procurementAlerts, setProcurementAlerts] = useState<ProcurementAlertPayload[]>([]);
  const [poGenerating, setPoGenerating] = useState(false);

  // Story 7.3: Staff Planning state
  const [staffPlanning, setStaffPlanning] = useState<{
    date: string;
    highTrafficFlag: boolean;
    semesterPeriod: string;
    predictedTotal: number;
    rollingAvg: number;
  } | null>(null);

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

      // Story 6.4: Smart discount alerts
      socket.on("smartDiscountAlert", (payload: SmartDiscountAlertPayload) => {
        setDiscountAlerts((prev) => {
          if (prev.some((a) => a.menuItemId === payload.menuItemId)) return prev;
          return [...prev, payload];
        });
      });

      // Story 6.4: Flash deal created/cancelled → refresh active deals
      socket.on("flashDealCreated", () => {
        setDealsRefreshKey((k) => k + 1);
      });

      socket.on("flashDealCancelled", () => {
        setDealsRefreshKey((k) => k + 1);
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

  // Story 6.4: Fetch smart discount alerts
  const checkDiscounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/smart-discounts");
      if (res.ok) {
        const json = await res.json();
        setDiscountAlerts(json.alerts);
      }
    } catch { /* ignore */ }
  }, []);

  // Story 7.2: Fetch procurement alerts
  const fetchProcurementAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/procurement/alerts");
      if (res.ok) {
        const json = await res.json();
        setProcurementAlerts(json.alerts);
      }
    } catch { /* ignore */ }
  }, []);

  // Story 7.3: Fetch staff planning / forecast data
  const fetchStaffPlanning = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/forecasts/latest");
      if (res.ok) {
        const json = await res.json();
        setStaffPlanning({
          date: json.date,
          highTrafficFlag: json.highTrafficFlag,
          semesterPeriod: json.semesterPeriod,
          predictedTotal: json.predictedTotal ?? 0,
          rollingAvg: json.rollingAvg ?? 0,
        });
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch both on mount (async wrapper satisfies react-hooks/exhaustive-deps)
  useEffect(() => {
    void (async () => {
      await Promise.all([checkDiscounts(), fetchProcurementAlerts(), fetchStaffPlanning()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Story 7.2: Generate Purchase Order PDF
  const handleGeneratePO = async () => {
    setPoGenerating(true);
    try {
      const res = await fetch("/api/admin/procurement/po");
      if (!res.ok) throw new Error("Failed to generate PO");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Purchase-Order-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Resolve alerts after successful download
      await fetch("/api/admin/procurement/resolve", { method: "POST" });
      setProcurementAlerts([]);
    } catch { /* ignore */ }
    finally {
      setPoGenerating(false);
    }
  };

  // Story 6.4: Open Flash Deal form
  const openDealForm = (menuItemId: string, name: string) => {
    const alert = discountAlerts.find((a) => a.menuItemId === menuItemId);
    setDealTarget({ menuItemId, name, price: alert?.currentPrice ?? 0 });
    setDealFormOpen(true);
  };

  const closeDealForm = () => {
    setDealFormOpen(false);
    setDealTarget(null);
    checkDiscounts();
    setDealsRefreshKey((k) => k + 1);
  };

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
            <div className="flex items-center gap-2 flex-wrap">
              <MlHealthIndicator />
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
                onClick={() => router.push("/admin/inventory")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <Boxes className="w-3.5 h-3.5" />
                Inventory
              </button>
              <button
                onClick={() => router.push("/admin/cook-plan")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Cook Plan
              </button>
              <button
                onClick={() => router.push("/admin/analytics")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics
              </button>
              <button
                onClick={() => router.push("/admin/settings")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
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

        {/* Story 6.4: Smart Discount Alerts */}
        {discountAlerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Smart Discount Alerts
              </h2>
              <button
                onClick={checkDiscounts}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Refresh
              </button>
            </div>
            {discountAlerts.map((alert) => (
              <SmartDiscountAlert
                key={alert.menuItemId}
                alert={alert}
                onCreateDeal={openDealForm}
              />
            ))}
          </div>
        )}

        {/* Story 6.4: Active Flash Deals */}
        <div className="space-y-3" key={dealsRefreshKey}>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Active Flash Deals
          </h2>
          <ActiveFlashDeals />
        </div>

        {/* Story 7.2: Procurement Alerts — always visible */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Procurement Alerts
              {procurementAlerts.length > 0 && (
                <span className="text-[11px] font-normal text-[var(--text-muted)]">
                  ({procurementAlerts.length} {procurementAlerts.length === 1 ? "item" : "items"} needs attention)
                </span>
              )}
            </h2>
            <button
              onClick={fetchProcurementAlerts}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Refresh
            </button>
          </div>
          {procurementAlerts.length === 0 ? (
            <div
              className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
              style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
            >
              <p className="text-xs text-[var(--text-muted)]">All ingredients are adequately stocked.</p>
            </div>
          ) : (
            procurementAlerts.map((alert) => (
              <ProcurementAlertCard
                key={alert.id}
                alert={alert}
                onGeneratePO={handleGeneratePO}
                poGenerating={poGenerating}
              />
            ))
          )}
        </div>

        {/* Story 7.3: Staff Planning */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Staff Planning
              {staffPlanning && (
                <span className="text-[11px] font-normal text-[var(--text-muted)]">
                  ({staffPlanning.date})
                </span>
              )}
            </h2>
            <button
              onClick={fetchStaffPlanning}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Refresh
            </button>
          </div>
          {!staffPlanning ? (
            <div
              className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
              style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
            >
              <p className="text-xs text-[var(--text-muted)]">No forecast data yet. Run a forecast to see staff planning.</p>
            </div>
          ) : staffPlanning.highTrafficFlag ? (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl p-4 border border-red-500/30 relative overflow-hidden"
              style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-25 -translate-y-1/2 translate-x-1/2"
                style={{ background: "oklch(0.55 0.20 15)" }} />
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "oklch(0.55 0.20 15) / 0.15", color: "oklch(0.55 0.20 15)" }}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-400">⚠ High Traffic Expected</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Predicted {staffPlanning.predictedTotal} orders vs. {Math.round(staffPlanning.rollingAvg)} daily average.
                    Consider scheduling additional staff for {staffPlanning.date}.
                  </p>
                  <p className="text-[10px] text-[var(--text-disabled)] mt-1">
                    Semester: {staffPlanning.semesterPeriod.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div
              className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
              style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-[var(--text-muted)]">
                  Normal traffic expected for {staffPlanning.date}. Predicted {staffPlanning.predictedTotal} orders (avg: {Math.round(staffPlanning.rollingAvg)}).
                  <span className="ml-1 text-[10px] text-[var(--text-disabled)]">
                    Semester: {staffPlanning.semesterPeriod.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Story 6.4: Flash Deal Form Modal */}
      {dealTarget && (
        <FlashDealForm
          isOpen={dealFormOpen}
          onClose={closeDealForm}
          menuItemId={dealTarget.menuItemId}
          menuItemName={dealTarget.name}
          currentPrice={dealTarget.price}
        />
      )}
    </div>
  );
}
