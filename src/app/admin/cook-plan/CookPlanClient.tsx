"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Save,
  Check,
  Lock,
  AlertTriangle,
  X,
  Info,
} from "lucide-react";

interface CookPlanItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  forecastQty: number;
  preOrderQty: number;
  finalQty: number;
  bufferQty: number;
  adminAdjusted: boolean;
  status: string;
  confidenceScore: number | null;
  modelVersion: string | null;
}

interface CookPlanData {
  date: string;
  isLocked: boolean;
  allConfirmed: boolean;
  items: CookPlanItem[];
}

interface Props {
  userName: string;
  initialData: CookPlanData;
}

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

let toastCounter = 0;

export default function CookPlanClient({ userName, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CookPlanData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage["type"] = "info") => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());

  const isToday = (() => {
    const t = new Date();
    return data.date === t.toISOString().split("T")[0];
  })();

  const fetchData = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = date
        ? "/api/admin/cook-plan?date=" + date
        : "/api/admin/cook-plan";
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setError("Failed to load Cook Plan.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  const goToDate = (offset: number) => {
    const d = new Date(data.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    fetchData(d.toISOString().split("T")[0]);
  };

  const handleSaveItem = async (id: string, finalQty: number) => {
    const existing = data.items.find((i) => i.id === id);
    if (!existing) return;

    if (
      existing.status === "CONFIRMED" &&
      data.isLocked &&
      overrideDialog !== id
    ) {
      setOverrideDialog(id);
      return;
    }

    const override = overrideDialog === id;
    setOverrideDialog(null);

    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/admin/cook-plan/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalQty, override }),
      });
      if (res.ok) {
        setSuccessIds((prev) => new Set(prev).add(id));
        setTimeout(
          () =>
            setSuccessIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            }),
          2000
        );
        addToast(
          "Row saved — Final Qty: " + finalQty + (override ? " (plan superseded)" : ""),
          "success"
        );
        fetchData(data.date);
      } else {
        const json = await res.json();
        addToast(json.message || json.error || "Save failed", "error");
      }
    } catch {
      addToast("Network error — please try again", "error");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/cook-plan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: data.date }),
      });
      const json = await res.json();
      if (res.ok && json.confirmed > 0) {
        addToast(
          json.confirmed +
            " items confirmed and locked" +
            (json.procurementAlertsTriggered
              ? " — procurement alerts updated"
              : ""),
          "success"
        );
        fetchData(data.date);
      } else if (res.ok && json.confirmed === 0) {
        addToast(
          "No SUGGESTED items to confirm. Generate the Cook Plan first from Settings.",
          "error"
        );
      } else {
        addToast(json.error || "Confirmation failed", "error");
      }
    } catch {
      addToast("Network error — confirmation failed", "error");
    } finally {
      setConfirming(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      SUGGESTED: "bg-blue-500/20 text-blue-400",
      CONFIRMED: "bg-emerald-500/20 text-emerald-400",
      SUPERSEDED: "bg-amber-500/20 text-amber-400",
    };
    return (
      <span
        className={
          "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase " +
          (colors[status] || "bg-white/10 text-[var(--text-muted)]")
        }
      >
        {status}
      </span>
    );
  };

  const tomorrowStr = (() => {
    const d = new Date(data.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0];
  })();
  const canGoNext = data.date < tomorrowStr;

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* ── Toast notifications ── */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={
                "rounded-xl px-4 py-3 text-xs font-medium shadow-lg border flex items-center gap-2 " +
                (toast.type === "success"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : toast.type === "error"
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "bg-blue-500/15 border-blue-500/30 text-blue-400")
              }
            >
              {toast.type === "success" ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : toast.type === "error" ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Info className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{toast.text}</span>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="ml-auto p-0.5 rounded hover:bg-white/10"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl p-6 max-w-md w-full border border-[rgba(255,255,255,0.12)] shadow-2xl"
              style={{
                background: "oklch(0.15 0.01 260)",
                backdropFilter: "blur(24px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "oklch(0.55 0.20 150) / 0.15",
                  }}
                >
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Confirm Cook Plan?
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    This locks all quantities and transitions the plan from
                    SUGGESTED to CONFIRMED. After 10:00 AM, editing requires an
                    override.
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Date:{" "}
                    <span className="text-[var(--text-primary)]">
                      {data.date}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.55 0.20 150), oklch(0.45 0.20 150))",
                  }}
                >
                  {confirming ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  Lock Cook Plan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              Cook Plan
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Welcome, {userName}
              {data.allConfirmed && (
                <span className="ml-2 text-emerald-400 text-[11px]">
                  ● Confirmed
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => fetchData(data.date)}
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-xs underline"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* ── Lock banner ── */}
        {data.allConfirmed && isToday && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 border border-amber-500/30 relative overflow-hidden"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
            }}
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-400">
                  Cook Plan Locked
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  This plan was confirmed and is now locked. Editing requires an
                  override confirmation.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Override dialog ── */}
        {overrideDialog && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 border border-red-500/30 relative overflow-hidden"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400">
                  Override Required
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  This will mark the current plan as SUPERSEDED and create a new
                  revision. This cannot be undone.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() =>
                      handleSaveItem(
                        overrideDialog,
                        parseInt(editValues[overrideDialog] || "0") || 0
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Confirm Override
                  </button>
                  <button
                    onClick={() => setOverrideDialog(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Cook Plan Table ── */}
        <div className="bg-[oklch(0.11_0.01_260)] backdrop-blur-sm rounded-xl border border-[rgba(255,255,255,0.07)] shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[oklch(0.10_0.01_260)]">
            <button
              onClick={() => goToDate(-1)}
              className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)]"
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
              disabled={!canGoNext}
              className={
                "p-1 rounded-md " +
                (!canGoNext
                  ? "text-[var(--text-disabled)] cursor-not-allowed"
                  : "hover:bg-white/10 text-[var(--text-secondary)]")
              }
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {data.items.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardCheck className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                No Cook Plan for {data.date}.
              </p>
              <p className="text-xs text-[var(--text-disabled)] mt-1">
                {isToday
                  ? "Run the nightly forecast or generate manually from Settings."
                  : "Forecasts are generated one day ahead."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[oklch(0.10_0.01_260)]">
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Menu Item
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Forecast
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Pre-Orders
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Buffer
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Final Qty
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[70px]">
                      Save
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const isReadOnly =
                      item.status === "CONFIRMED" && data.isLocked;
                    const editVal =
                      editValues[item.id] !== undefined
                        ? editValues[item.id]
                        : String(item.finalQty);

                    return (
                      <motion.tr
                        key={item.id}
                        className="border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <td className="py-3 px-3">
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {item.menuItemName}
                          </span>
                          {item.confidenceScore !== null && (
                            <span className="ml-1.5 text-[10px] text-[var(--text-disabled)]">
                              {item.confidenceScore}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {item.forecastQty}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {item.preOrderQty}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="text-xs font-mono text-[var(--text-muted)]">
                            +{item.bufferQty}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={editVal}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            readOnly={isReadOnly && true}
                            className={
                              "w-16 h-7 text-xs text-center rounded-md border " +
                              (isReadOnly
                                ? "bg-white/5 border-[rgba(255,255,255,0.05)] text-[var(--text-disabled)] cursor-not-allowed"
                                : "bg-[oklch(0.12_0.01_260)] border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]") +
                              (item.adminAdjusted
                                ? " border-l-amber-500/50"
                                : "")
                            }
                          />
                        </td>
                        <td className="py-3 px-2 text-center">
                          {statusBadge(item.status)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {successIds.has(item.id) ? (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="inline-block text-emerald-400"
                            >
                              <Check className="w-4 h-4" />
                            </motion.span>
                          ) : savingIds.has(item.id) ? (
                            <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin mx-auto" />
                          ) : (
                            !isReadOnly && (
                              <button
                                onClick={() =>
                                  handleSaveItem(
                                    item.id,
                                    parseInt(editVal) || 0
                                  )
                                }
                                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                title="Save this row's Final Qty"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                            )
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Confirm button ── */}
          {data.items.some((i) => i.status === "SUGGESTED") && (
            <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[oklch(0.10_0.01_260)]">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-[var(--text-disabled)]">
                  <span className="text-emerald-400 font-medium">Save</span>{" "}
                  updates a single row &middot;{" "}
                  <span className="text-emerald-400 font-medium">Confirm</span>{" "}
                  locks all rows
                </div>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={confirming}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.55 0.20 150), oklch(0.45 0.20 150))",
                  }}
                >
                  {confirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Confirm Cook Plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
