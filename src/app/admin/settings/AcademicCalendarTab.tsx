"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, Pencil, Trash2, Check, X, Loader2, Play, Brain } from "lucide-react";

interface CalendarEntry {
  id: string;
  semesterPeriod: string;
  startDate: string;
  endDate: string;
  label: string;
}

interface Props {
  userName: string;
  initialEntries: CalendarEntry[];
  currentSemesterPeriod: string;
}

const PERIOD_OPTIONS = [
  { value: "REGULAR_LECTURES", label: "Regular Lectures" },
  { value: "PRE_EXAM_WEEK", label: "Pre-Exam Week" },
  { value: "STUDY_LEAVE", label: "Study Leave" },
  { value: "EXAM_PERIOD", label: "Exam Period" },
];

export default function AcademicCalendarTab({
  userName: _userName,
  initialEntries,
  currentSemesterPeriod,
}: Props) {
  void _userName;
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forecastRunning, setForecastRunning] = useState(false);
  const [forecastResult, setForecastResult] = useState<string | null>(null);
  const [retrainRunning, setRetrainRunning] = useState(false);

  // Form state
  const [period, setPeriod] = useState("REGULAR_LECTURES");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [label, setLabel] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPeriod, setEditPeriod] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const fetchEntries = useCallback(async () => {
    const res = await fetch("/api/admin/academic-calendar");
    if (res.ok) {
      const json = await res.json();
      setEntries(json.entries);
    }
  }, []);

  const handleCreate = async () => {
    if (!startDate || !endDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/academic-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterPeriod: period,
          startDate,
          endDate,
          label: label || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setPeriod("REGULAR_LECTURES");
        setStartDate("");
        setEndDate("");
        setLabel("");
        fetchEntries();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    if (!editStart || !editEnd) return;
    try {
      const res = await fetch(`/api/admin/academic-calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterPeriod: editPeriod,
          startDate: editStart,
          endDate: editEnd,
          label: editLabel || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchEntries();
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this calendar entry?")) return;
    try {
      await fetch(`/api/admin/academic-calendar/${id}`, { method: "DELETE" });
      fetchEntries();
    } catch { /* ignore */ }
  };

  const startEdit = (entry: CalendarEntry) => {
    setEditingId(entry.id);
    setEditPeriod(entry.semesterPeriod);
    setEditStart(entry.startDate);
    setEditEnd(entry.endDate);
    setEditLabel(entry.label);
  };

  const handleRunForecast = async () => {
    setForecastRunning(true);
    setForecastResult(null);
    try {
      const res = await fetch("/api/admin/forecasts/trigger", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setForecastResult(
          `Generated ${json.forecastsGenerated} forecasts. ` +
            `High Traffic: ${json.highTrafficFlag ? "Yes" : "No"}. ` +
            `Fallback: ${json.fallbackUsed ? "Yes (ML unavailable)" : "No"}.`
        );
      } else {
        setForecastResult(`Error: ${json.error || "Unknown error"}`);
      }
    } catch {
      setForecastResult("Network error — could not trigger forecast.");
    } finally {
      setForecastRunning(false);
    }
  };

  const handleRetrain = async () => {
    setRetrainRunning(true);
    setForecastResult(null);
    try {
      const res = await fetch("/api/admin/forecasts/retrain", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setForecastResult(
          "Retraining complete — " + json.summary.trained + " trained, " +
          json.summary.rolledBack + " rolled back, " +
          json.summary.skipped + " skipped"
        );
      } else {
        setForecastResult("Error: " + (json.error || "Unknown error"));
      }
    } catch {
      setForecastResult("Network error — could not trigger retraining.");
    } finally {
      setRetrainRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Academic Calendar</h3>
          <p className="text-xs text-[var(--text-muted)]">Current semester: <span className="text-emerald-400">{PERIOD_OPTIONS.find((o) => o.value === currentSemesterPeriod)?.label ?? "Regular Lectures"}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRunForecast} disabled={forecastRunning} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors">{forecastRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run Forecast</button>
          <button onClick={handleRetrain} disabled={retrainRunning} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors">{retrainRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Retrain Models</button>
        </div>
      </div>
      {forecastResult && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{forecastResult}</div>}
      <div>
        {/* Academic Calendar */}
        <div className="bg-[oklch(0.11_0.01_260)] backdrop-blur-sm rounded-xl border border-[rgba(255,255,255,0.07)] shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[oklch(0.10_0.01_260)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Academic Calendar
              </h2>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Period
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex flex-wrap items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]" />
              <span className="text-xs text-[var(--text-muted)]">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)]" />
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional)"
                className="h-8 px-2 rounded-md text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] w-40" />
              <button onClick={handleCreate} disabled={saving || !startDate || !endDate}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button onClick={() => setShowForm(false)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Entries table */}
          {entries.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">No academic calendar entries configured.</p>
              <p className="text-xs text-[var(--text-disabled)] mt-1">
                Default: REGULAR_LECTURES will be used for all forecasts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[oklch(0.10_0.01_260)]">
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Period</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Start</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">End</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Label</th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <motion.tr
                      key={entry.id}
                      className="border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td className="py-3 px-3">
                        {editingId === entry.id ? (
                          <select value={editPeriod} onChange={(e) => setEditPeriod(e.target.value)}
                            className="h-7 px-1 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md">
                            {PERIOD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {PERIOD_OPTIONS.find((o) => o.value === entry.semesterPeriod)?.label ?? entry.semesterPeriod}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {editingId === entry.id ? (
                          <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                            className="h-7 px-1 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md" />
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">{entry.startDate}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {editingId === entry.id ? (
                          <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                            className="h-7 px-1 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md" />
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">{entry.endDate}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {editingId === entry.id ? (
                          <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                            className="h-7 px-1 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md w-32" />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">{entry.label || "—"}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {editingId === entry.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleUpdate(entry.id)} className="p-1 text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(entry)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(entry.id)} className="p-1 text-[var(--text-muted)] hover:text-red-400">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
