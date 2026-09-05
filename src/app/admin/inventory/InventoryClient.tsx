"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Package, ChevronLeft, ChevronRight, RefreshCw, Loader2, ArrowLeft, Plus, X, Check } from "lucide-react";
import InventoryTableRow, { type IngredientRowData } from "@/components/admin/InventoryTableRow";
import { getColomboDateString } from "@/lib/date-utils";

interface InventoryData { date: string; ingredients: IngredientRowData[]; }

interface HistoryEntry {
  date: string;
  ingredients: Array<{ id: string; name: string; unit: string; openingStock: number | null; receivedStock: number | null; consumedStock: number | null; closingStock: number | null; wastage: number | null }>;
}

interface Props { userName: string; initialData: InventoryData; }

export default function InventoryClient({ userName, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<InventoryData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(() => {
    const colomboNow = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
    const d = new Date(Date.UTC(colomboNow.getUTCFullYear(), colomboNow.getUTCMonth(), colomboNow.getUTCDate() - 7));
    return d.toISOString().split("T")[0];
  });
  const [historyTo, setHistoryTo] = useState(() => getColomboDateString());
  const [procurableIds, setProcurableIds] = useState<Map<string, string>>(new Map());

  // Ingredient management state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngUnit, setNewIngUnit] = useState("kg");
  const [addingIng, setAddingIng] = useState(false);
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [editIngName, setEditIngName] = useState("");
  const [editIngUnit, setEditIngUnit] = useState("");

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/procurement/alerts");
      if (res.ok) {
        const json = await res.json();
        const map = new Map<string, string>();
        for (const a of json.alerts) {
          map.set(a.ingredientId, a.tier || "CRITICAL");
        }
        setProcurableIds(map);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async (date?: string) => {
    setLoading(true); setError(null);
    try {
      const url = date ? `/api/admin/inventory?date=${date}` : "/api/admin/inventory";
      const res = await fetch(url);
      if (res.ok) setData(await res.json()); else setError("Failed to load inventory data.");
      fetchAlerts();
      // Invalidate history cache so next manual refresh fetches fresh data
      setHistory([]);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [fetchAlerts]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/history?from=${historyFrom}&to=${historyTo}`);
      if (res.ok) setHistory((await res.json()).history);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, [historyFrom, historyTo]);

  const toggleHistory = useCallback(() => { setShowHistory((p) => { if (!p) fetchHistory(); return !p; }); }, [fetchHistory]);
  const goToDate = (offset: number) => { const c = new Date(data.date + "T00:00:00Z"); c.setDate(c.getDate() + offset); fetchData(c.toISOString().split("T")[0]); };

  // Ingredient management handlers
  const handleAddIngredient = async () => {
    if (!newIngName.trim()) return;
    setAddingIng(true);
    try {
      await fetch("/api/admin/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newIngName.trim(), unit: newIngUnit }),
      });
      setNewIngName("");
      setNewIngUnit("kg");
      setShowAddForm(false);
      fetchData(data.date);
    } catch { /* ignore */ }
    finally { setAddingIng(false); }
  };

  const handleEditIngredient = async (id: string) => {
    if (!editIngName.trim()) return;
    try {
      await fetch(`/api/admin/ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editIngName.trim(), unit: editIngUnit }),
      });
      setEditingIngId(null);
      fetchData(data.date);
    } catch { /* ignore */ }
  };

  const handleRetireIngredient = async (id: string, name: string) => {
    if (!confirm(`Retire "${name}"? It will be hidden from daily entry but preserved in history.`)) return;
    try {
      await fetch(`/api/admin/ingredients/${id}`, { method: "DELETE" });
      fetchData(data.date);
    } catch { /* ignore */ }
  };

  const startEditing = (ing: IngredientRowData) => {
    setEditingIngId(ing.id);
    setEditIngName(ing.name);
    setEditIngUnit(ing.unit);
  };

  const todayStr = getColomboDateString();
  const isToday = data.date === todayStr;
  const tomorrowStr = (() => {
    const d = new Date(data.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0];
  })();
  const hasStocks = data.ingredients.some((i) => i.openingStock !== null || i.receivedStock !== null || i.consumedStock !== null || i.closingStock !== null);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin/dashboard")} className="p-1">
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <div><h1 className="text-lg font-bold text-[var(--text-primary)]">Inventory</h1><p className="text-xs text-[var(--text-muted)]">Welcome, {userName}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleHistory} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showHistory ? "bg-white/10 text-[var(--text-primary)]" : "bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]"}`}>
              <Package className="w-3.5 h-3.5" />{showHistory ? "Today" : "7-Day History"}
            </button>
            <button onClick={() => fetchData()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Refresh
            </button>
          </div>
        </div>
        {/* Ingredient Management Bar */}
        <div className="max-w-4xl mx-auto mt-3 flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Ingredient
          </button>
          {showAddForm && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                placeholder="Ingredient name"
                className="h-8 px-2 rounded-md text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] w-36"
                onKeyDown={(e) => e.key === "Enter" && handleAddIngredient()}
              />
              <select
                value={newIngUnit}
                onChange={(e) => setNewIngUnit(e.target.value)}
                className="h-8 px-2 rounded-md text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)]"
              >
                <option value="kg">kg</option>
                <option value="liters">liters</option>
              </select>
              <button
                onClick={handleAddIngredient}
                disabled={addingIng || !newIngName.trim()}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
              >
                {addingIng ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewIngName(""); }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</motion.div>}
        {!showHistory ? (
          <div className="bg-[var(--bg-elevated)] backdrop-blur-sm rounded-xl border border-[var(--border-subtle)] shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
              <button onClick={() => goToDate(-1)} className="p-1 rounded-md hover:bg-white/10 text-[var(--text-secondary)]" aria-label="Previous day"><ChevronLeft className="w-4 h-4" /></button>
              <div className="text-center"><span className="text-sm font-semibold text-[var(--text-primary)]">{new Date(data.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>{isToday && <span className="ml-2 text-[11px] text-emerald-400 font-medium">Today</span>}</div>
              <button onClick={() => goToDate(1)} disabled={isToday} className={`p-1 rounded-md ${isToday ? "text-[var(--text-disabled)] cursor-not-allowed" : "hover:bg-white/10 text-[var(--text-secondary)]"}`} aria-label="Next day"><ChevronRight className="w-4 h-4" /></button>
            </div>
            {data.ingredients.length === 0 ? (
              <div className="py-12 text-center"><Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" /><p className="text-sm text-[var(--text-muted)]">No ingredients configured yet.</p></div>
            ) : !hasStocks ? (
              <div className="py-12 text-center"><Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" /><p className="text-sm text-[var(--text-muted)]">No inventory records for {data.date}.</p><p className="text-xs text-[var(--text-disabled)] mt-1">Enter opening stock to get started.</p></div>
            ) : null}
            {data.ingredients.length > 0 && (
              <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-[var(--border-default)] bg-[var(--bg-overlay)]"><th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ingredient</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Opening</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Received</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Consumed</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Closing</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Wastage</th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Forecasted Need<span className="block text-[10px] font-normal text-[var(--text-disabled)] normal-case">for {tomorrowStr}</span></th><th className="py-2.5 px-2 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[80px]">Action</th></tr></thead><tbody>
              {data.ingredients.map((ing) => <InventoryTableRow key={ing.id} ingredient={ing} date={data.date} alertTier={procurableIds.get(ing.id) ?? null} onSaved={() => fetchData(data.date)} onEdit={(ing) => startEditing(ing)} onRetire={handleRetireIngredient} isEditing={editingIngId === ing.id} editName={editIngName} editUnit={editIngUnit} onEditNameChange={setEditIngName} onEditUnitChange={setEditIngUnit} onSaveEdit={handleEditIngredient} onCancelEdit={() => setEditingIngId(null)} />)}
              </tbody></table></div>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-elevated)] backdrop-blur-sm rounded-xl border border-[var(--border-subtle)] shadow-lg overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date Range</span>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-8 px-2 rounded-md text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)]" />
              <span className="text-xs text-[var(--text-muted)]">to</span>
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-8 px-2 rounded-md text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)]" />
              <button onClick={fetchHistory} disabled={historyLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]">{historyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Apply</button>
            </div>
            {historyLoading ? <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin mx-auto mb-3" /><p className="text-sm text-[var(--text-muted)]">Loading history...</p></div>
            : history.length === 0 ? <div className="py-12 text-center"><Package className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3" /><p className="text-sm text-[var(--text-muted)]">No inventory records found for this date range.</p></div>
            : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-[var(--border-default)] bg-[var(--bg-overlay)]"><th className="sticky left-0 z-10 bg-[var(--bg-overlay)] py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider min-w-[120px]">Date</th>
            {history[0].ingredients.map((ing) => <th key={ing.id} className="py-2.5 px-3 text-center text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap min-w-[100px]">{ing.name}<span className="block text-[10px] font-normal text-[var(--text-disabled)]">({ing.unit})</span></th>)}</tr></thead><tbody>
            {history.map((entry) => <motion.tr key={entry.date} className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <td className="sticky left-0 z-10 bg-[var(--bg-elevated)] py-3 px-3 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">{new Date(entry.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              {entry.ingredients.map((ing) => <td key={ing.id} className="py-3 px-3 text-center text-xs">{ing.openingStock !== null ? <div><span className="text-[var(--text-secondary)] font-mono">O: {ing.openingStock.toFixed(3)}</span>{ing.receivedStock !== null && <><br /><span className="text-[var(--text-muted)] font-mono">R: {ing.receivedStock.toFixed(3)}</span></>}{ing.consumedStock !== null && <><br /><span className="text-[var(--text-muted)] font-mono">C: {ing.consumedStock.toFixed(3)}</span></>}{ing.closingStock !== null && <><br /><span className="text-[var(--text-muted)] font-mono">Cl: {ing.closingStock.toFixed(3)}</span></>}{ing.wastage !== null && <><br /><span className={`font-mono text-[11px] ${ing.wastage > 0 ? "text-amber-400" : "text-emerald-400"}`}>W: {ing.wastage.toFixed(3)}</span></>}</div> : <span className="text-[var(--text-disabled)]">—</span>}</td>)}
            </motion.tr>)}</tbody></table></div>}
          </div>
        )}
      </div>
    </div>
  );
}
