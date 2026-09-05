"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import SpendChart from "@/components/analytics/SpendChart";

interface TopItem { name: string; count: number; }

interface Props {
  weekTotal: number;
  monthTotal: number;
  avgDaily: number;
  totalOrders: number;
  preOrderCount: number;
  walkInCount: number;
  topItems: TopItem[];
  chartData: { day: string; spend: number }[];
}

export default function AnalyticsPageContent(props: Props) {
  const { weekTotal, monthTotal, avgDaily, totalOrders, preOrderCount, walkInCount, topItems, chartData } = props;
  const router = useRouter();

  const prePct = totalOrders > 0 ? Math.round((preOrderCount / totalOrders) * 100) : 0;
  const walkPct = totalOrders > 0 ? Math.round((walkInCount / totalOrders) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push("/student/home")} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
        </div>

        {/* Empty state */}
        {totalOrders === 0 && (
          <div className="text-center py-16">
            <BarChart3 className="w-12 h-12 text-[var(--text-disabled)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] text-sm">You haven&apos;t placed any orders yet.</p>
            <p className="text-[var(--text-disabled)] text-xs mt-1">Start browsing the menu to see your analytics!</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "This Week", value: `Rs.${weekTotal.toLocaleString()}`, color: "var(--brand)" },
            { label: "This Month", value: `Rs.${monthTotal.toLocaleString()}`, color: "var(--brand)" },
            { label: "Avg Daily", value: `Rs.${avgDaily.toLocaleString()}`, color: "rgb(250,204,21)" },
            { label: "Total Orders", value: String(totalOrders), color: "rgb(74,222,128)" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl p-4" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{c.label}</p>
              <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Top 3 Items */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
          <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Top Items</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-[var(--text-disabled)]">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item, i) => {
                const max = topItems[0]?.count ?? 1;
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)] w-5">#{i + 1}</span>
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{item.name}</span>
                    <div className="w-20 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-[var(--text-muted)] w-6 text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pre-Order vs Walk-In */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
          <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Order Type</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1"><span className="text-[var(--brand)]">Pre-Order</span><span className="text-[var(--text-muted)]">{prePct}%</span></div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${prePct}%` }} />
              </div>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{preOrderCount} / {walkInCount}</span>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1"><span className="text-amber-400">Walk-In</span><span className="text-[var(--text-muted)]">{walkPct}%</span></div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${walkPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Chart */}
        <SpendChart data={chartData} />
      </div>
    </div>
  );
}
