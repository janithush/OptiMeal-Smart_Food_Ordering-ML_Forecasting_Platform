"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import InventoryTableRow, { type IngredientRowData } from "@/components/admin/InventoryTableRow";

interface InventoryData {
  date: string;
  ingredients: IngredientRowData[];
}

interface HistoryEntry {
  date: string;
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    openingStock: number | null;
    closingStock: number | null;
    wastage: number | null;
  }>;
}

interface Props {
  userName: string;
  initialData: InventoryData;
}

export default function InventoryClient({ userName, initialData }: Props) {
  const [data, setData] = useState<InventoryData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [historyTo, setHistoryTo] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  // Fetch today's data
  const fetchData = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = date
        ? `/api/admin/inventory?date=${date}`
        : "/api/admin/inventory";
      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load inventory data.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const url = `/api/admin/inventory/history?from=${historyFrom}&to=${historyTo}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.history);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFrom, historyTo]);

  // Toggle history view and fetch on open
  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => {
      if (!prev) {
        fetchHistory();
      }
      return !prev;
    });
  }, [fetchHistory]);

  // Navigate date for today's view

  // Navigate date for today's view
  const goToDate = (offset: number) => {
    const current = new Date(data.date + "T00:00:00Z");
    current.setDate(current.getDate() + offset);
    fetchData(current.toISOString().split("T")[0]);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = data.date === todayStr;

  const hasStocks = data.ingredients.some(
    (i) => i.openingStock !== null || i.closingStock !== null
  );

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">
                Inventory
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome, {userName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleHistory}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showHistory
                    ? "bg-white/10 text-[var(--text-primary)]"
                    : "bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                {showHistory ? "Today" : "7-Day History"}
              </button>
              <button
                onClick={() => fetchData()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

        {!showHistory ? (
          <>
            {/* Today's View */}
            <div className="bg-[oklch(0.11_0.01_260)] backdrop-blur-sm rounded-xl border border-[rgba(255,255,255,0.07)] shadow-lg overflow-hidden">
              {/* Date Navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[oklch(0.10_0.01_260)]">
                <button
                  onClick={() => goToDate(-1)}
                  className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {new Date(data.date + "T00:00:00Z").toLocaleDateString(
                      "en-US",
                      { weekday: "long", month: "short", day: "numeric" }
                    )}
                  </span>
                  {isToday && (
                    <span className="ml-2 text-[11px] text-emerald-400 font-medium">
                      Today
                    </span>
                  )}
                </div>
                <button
                  onClick={() => goToDate(1)}
                  disabled={isToday}
                  className={`p-1 rounded-md transition-colors ${
                    isToday
                      ? "text-[var(--text-disabled)] cursor-not-allowed"
                      : "hover:bg-white/10 text-[var(--text-secondary)]"
                  }`}
                  aria-label="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Table */}
              {data.ingredients.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">
                    No ingredients configured yet.
                  </p>
                  <p className="text-xs text-[var(--text-disabled)] mt-1">
                    Add ingredients from the Menu Management screen first.
                  </p>
                </div>
              ) : !hasStocks ? (
                <div className="py-12 text-center">
                  <Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">
                    No inventory records for {data.date}.
                  </p>
                  <p className="text-xs text-[var(--text-disabled)] mt-1">
                    Enter opening stock to get started.
                  </p>
                </div>
              ) : null}

              {data.ingredients.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[oklch(0.10_0.01_260)]">
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Ingredient
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Opening
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Closing
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Wastage
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Forecasted Need
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[80px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ingredients.map((ing) => (
                        <InventoryTableRow
                          key={ing.id}
                          ingredient={ing}
                          date={data.date}
                          onSaved={() => {
                            // Refetch to get server-computed wastage
                            fetchData(data.date);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 7-Day History View */}
            <div className="bg-[oklch(0.11_0.01_260)] backdrop-blur-sm rounded-xl border border-[rgba(255,255,255,0.07)] shadow-lg overflow-hidden">
              {/* Date Range Controls */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[oklch(0.10_0.01_260)]">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Date Range
                </span>
                <input
                  type="date"
                  value={historyFrom}
                  onChange={(e) => setHistoryFrom(e.target.value)}
                  className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]"
                  aria-label="From date"
                />
                <span className="text-xs text-[var(--text-muted)]">to</span>
                <input
                  type="date"
                  value={historyTo}
                  onChange={(e) => setHistoryTo(e.target.value)}
                  className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]"
                  aria-label="To date"
                />
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
                >
                  {historyLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Apply
                </button>
              </div>

              {/* History Table - Ingredients as rows, dates as columns */}
              {historyLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">
                    No inventory records found for this date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[oklch(0.10_0.01_260)]">
                        <th className="sticky left-0 z-10 bg-[oklch(0.10_0.01_260)] py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider min-w-[120px]">
                          Date
                        </th>
                        {history.length > 0 &&
                          history[0].ingredients.map((ing) => (
                            <th
                              key={ing.id}
                              className="py-2.5 px-3 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap min-w-[100px]"
                            >
                              {ing.name}
                              <span className="block text-[10px] font-normal text-[var(--text-disabled)]">
                                ({ing.unit})
                              </span>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <motion.tr
                          key={entry.date}
                          className="border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02] transition-colors"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15 }}
                        >
                          <td className="sticky left-0 z-10 bg-[oklch(0.11_0.01_260)] py-3 px-3 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
                            {new Date(
                              entry.date + "T00:00:00Z"
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          {entry.ingredients.map((ing) => (
                            <td
                              key={ing.id}
                              className="py-3 px-3 text-center text-xs"
                            >
                              {ing.openingStock !== null ? (
                                <div>
                                  <span className="text-[var(--text-secondary)] font-mono">
                                    O: {ing.openingStock.toFixed(3)}
                                  </span>
                                  {ing.closingStock !== null && (
                                    <>
                                      <br />
                                      <span className="text-[var(--text-muted)] font-mono">
                                        C: {ing.closingStock.toFixed(3)}
                                      </span>
                                    </>
                                  )}
                                  {ing.wastage !== null && (
                                    <>
                                      <br />
                                      <span
                                        className={`font-mono text-[11px] ${
                                          ing.wastage > 0
                                            ? "text-amber-400"
                                            : "text-emerald-400"
                                        }`}
                                      >
                                        W: {ing.wastage.toFixed(3)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[var(--text-disabled)]">
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
