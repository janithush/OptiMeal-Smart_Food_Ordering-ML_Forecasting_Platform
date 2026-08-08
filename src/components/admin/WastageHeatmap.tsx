"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface WastageDay {
  date: string;
  openingStock: number | null;
  receivedStock: number | null;
  consumedStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  wasteRate: number | null;
}

interface WastageIngredient {
  id: string;
  name: string;
  unit: string;
  days: WastageDay[];
}

interface WastageResponse {
  dateRange: { from: string; to: string };
  ingredients: WastageIngredient[];
}

// ── Helpers ──────────────────────────────────────────────────────

function colorClass(rate: number | null): string {
  if (rate === null) return "text-[var(--text-disabled)]";
  if (rate > 15) return "bg-red-500/20 text-red-400";
  if (rate >= 8) return "bg-amber-500/20 text-amber-400";
  return "bg-emerald-500/20 text-emerald-400";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────

export default function WastageHeatmap() {
  const [data, setData] = useState<WastageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailCell, setDetailCell] = useState<{
    ingredientName: string;
    unit: string;
    day: WastageDay;
  } | null>(null);

  useEffect(function () {
    fetch("/api/admin/analytics/wastage")
      .then(function (res) { return res.json(); })
      .then(function (json) { setData(json); setLoading(false); })
      .catch(function () { setError("Failed to load wastage data."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
        <p className="text-xs text-red-400 text-center py-8">{error || "No data available."}</p>
      </div>
    );
  }

  if (data.ingredients.length === 0) {
    return (
      <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
        <p className="text-xs text-[var(--text-muted)] text-center py-8">No active ingredients found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] overflow-hidden" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Wastage Heatmap
        <span className="ml-2 text-[10px] font-normal normal-case text-[var(--text-disabled)]">
          {data.dateRange.from} — {data.dateRange.to}
        </span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <th className="sticky left-0 z-10 py-2 px-3 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[oklch(0.13_0.01_260)] min-w-[100px]">Ingredient</th>
              {data.ingredients[0]?.days.map(function (d) {
                return (
                  <th key={d.date} className="py-2 px-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">
                    {formatDate(d.date)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.ingredients.map(function (ing) {
              return (
                <motion.tr
                  key={ing.id}
                  className="border-b border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <td className="sticky left-0 z-10 py-2.5 px-3 bg-[oklch(0.11_0.01_260)]">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{ing.name}</span>
                    <span className="ml-1 text-[10px] text-[var(--text-disabled)]">({ing.unit})</span>
                  </td>
                  {ing.days.map(function (day) {
                    var cellColor = colorClass(day.wasteRate);
                    return (
                      <td key={day.date} className="py-2 px-1 text-center">
                        {day.wasteRate !== null ? (
                          <button
                            onClick={function () { setDetailCell({ ingredientName: ing.name, unit: ing.unit, day: day }); }}
                            className={"px-2 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer hover:opacity-80 transition-opacity " + cellColor}
                            title={day.wastage !== null ? day.wastage + " " + ing.unit + " waste" : "No data"}
                          >
                            {day.wasteRate.toFixed(1)}%
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--text-disabled)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Legend:</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400">&gt;15%</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400">8–15%</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400">&lt;8%</span>
      </div>

      {/* ── Cell Detail Overlay ── */}
      <AnimatePresence>
        {detailCell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={function () { setDetailCell(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl p-5 max-w-sm w-full border border-[rgba(255,255,255,0.12)] shadow-2xl"
              style={{ background: "oklch(0.15 0.01 260)" }}
              onClick={function (e) { e.stopPropagation(); }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{detailCell.ingredientName}</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">{detailCell.day.date} · {detailCell.unit}</p>
                </div>
                <button
                  onClick={function () { setDetailCell(null); }}
                  className="p-1 rounded-md hover:bg-white/10 text-[var(--text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Opening Stock</span>
                  <span className="font-mono text-[var(--text-primary)]">{detailCell.day.openingStock?.toFixed(3)} {detailCell.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Received Stock</span>
                  <span className="font-mono text-[var(--text-primary)]">{(detailCell.day.receivedStock ?? 0).toFixed(3)} {detailCell.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Consumed Stock</span>
                  <span className="font-mono text-[var(--text-primary)]">{(detailCell.day.consumedStock ?? 0).toFixed(3)} {detailCell.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Closing Stock</span>
                  <span className="font-mono text-[var(--text-primary)]">{detailCell.day.closingStock !== null ? detailCell.day.closingStock.toFixed(3) : "—"} {detailCell.unit}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="text-[var(--text-muted)]">Wastage</span>
                  <span className={"font-mono font-semibold " + colorClass(detailCell.day.wasteRate)}>
                    {detailCell.day.wastage?.toFixed(3)} {detailCell.unit}
                    {detailCell.day.wasteRate !== null ? " (" + detailCell.day.wasteRate.toFixed(1) + "%)" : ""}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
