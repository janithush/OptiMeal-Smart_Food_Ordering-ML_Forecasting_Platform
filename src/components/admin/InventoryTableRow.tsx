"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, Check, Loader2, Pencil, Trash2, X } from "lucide-react";

export interface IngredientRowData {
  id: string;
  name: string;
  unit: string;
  openingStock: number | null;
  receivedStock: number | null;
  consumedStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  forecastedNeed: number | null;
  hasForecast: boolean;
}

interface Props {
  ingredient: IngredientRowData;
  date: string;
  onSaved: () => void;
  hasAlert?: boolean;
  alertTier?: string | null;
  onEdit?: (ing: IngredientRowData) => void;
  onRetire?: (id: string, name: string) => void;
  isEditing?: boolean;
  editName?: string;
  editUnit?: string;
  onEditNameChange?: (v: string) => void;
  onEditUnitChange?: (v: string) => void;
  onSaveEdit?: (id: string) => void;
  onCancelEdit?: () => void;
}

export default function InventoryTableRow({ ingredient, date, onSaved, hasAlert, alertTier, onEdit, onRetire, isEditing, editName, editUnit, onEditNameChange, onEditUnitChange, onSaveEdit, onCancelEdit }: Props) {
  const [opening, setOpening] = useState(
    ingredient.openingStock !== null ? String(ingredient.openingStock) : ""
  );
  const [received, setReceived] = useState(
    ingredient.receivedStock !== null ? String(ingredient.receivedStock) : ""
  );
  const [consumed, setConsumed] = useState(
    ingredient.consumedStock !== null ? String(ingredient.consumedStock) : ""
  );
  const [closing, setClosing] = useState(
    ingredient.closingStock !== null ? String(ingredient.closingStock) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Derive computed wastage from current inputs
  const computedWastage = (() => {
    const o = parseFloat(opening);
    const r = parseFloat(received) || 0;
    const con = parseFloat(consumed) || 0;
    const cl = parseFloat(closing);
    if (!isNaN(o) && !isNaN(cl)) {
      return (o + r - con - cl).toFixed(3);
    }
    return null;
  })();

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(false);

    const oNum = parseFloat(opening);
    if (isNaN(oNum) || oNum < 0) {
      setError("Opening stock must be a valid non-negative number.");
      return;
    }

    const rNum = received.trim() !== "" ? parseFloat(received) : null;
    if (rNum !== null && (isNaN(rNum) || rNum < 0)) {
      setError("Received stock must be a valid non-negative number.");
      return;
    }

    const conNum = consumed.trim() !== "" ? parseFloat(consumed) : null;
    if (conNum !== null && (isNaN(conNum) || conNum < 0)) {
      setError("Consumed stock must be a valid non-negative number.");
      return;
    }

    const cNum = closing.trim() !== "" ? parseFloat(closing) : null;
    if (cNum !== null && (isNaN(cNum) || cNum < 0)) {
      setError("Closing stock must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: ingredient.id,
          date,
          openingStock: oNum,
          receivedStock: rNum,
          consumedStock: conNum,
          closingStock: cNum,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save stock entry.");
      } else {
        setSuccess(true);
        setIsDirty(false);
        onSaved();
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [opening, received, consumed, closing, ingredient.id, date, onSaved]);

  const handleOpeningChange = (val: string) => {
    setOpening(val);
    setIsDirty(true);
    setError(null);
    setSuccess(false);
  };

  const handleClosingChange = (val: string) => {
    setClosing(val);
    setIsDirty(true);
    setError(null);
    setSuccess(false);
  };

  const handleReceivedChange = (val: string) => {
    setReceived(val);
    setIsDirty(true);
    setError(null);
    setSuccess(false);
  };

  const handleConsumedChange = (val: string) => {
    setConsumed(val);
    setIsDirty(true);
    setError(null);
    setSuccess(false);
  };

  return (
    <motion.tr
      className={`border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02] transition-colors ${
        alertTier === "CRITICAL" ? "border-l-2 border-l-red-500/50" :
        alertTier === "WARNING" ? "border-l-2 border-l-amber-500/50" :
        hasAlert ? "border-l-2 border-l-red-500/50" : ""
      }`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Ingredient Name + Unit */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          {isEditing && onEditNameChange && onEditUnitChange ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editName ?? ""}
                onChange={(e) => onEditNameChange(e.target.value)}
                className="w-24 h-7 px-1.5 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
                onKeyDown={(e) => e.key === "Enter" && onSaveEdit?.(ingredient.id)}
              />
              <select
                value={editUnit ?? "kg"}
                onChange={(e) => onEditUnitChange(e.target.value)}
                className="h-7 px-1 text-xs bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
              >
                <option value="kg">kg</option>
                <option value="liters">liters</option>
              </select>
              <button onClick={() => onSaveEdit?.(ingredient.id)} className="p-0.5 text-emerald-400 hover:text-emerald-300" title="Save">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onCancelEdit?.()} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" title="Cancel">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {ingredient.name}
              </span>
              <span className="text-[11px] text-[var(--text-disabled)]">
                ({ingredient.unit})
              </span>
              {onEdit && (
                <button onClick={() => onEdit(ingredient)} className="ml-1 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" title="Edit ingredient">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onRetire && (
                <button onClick={() => onRetire(ingredient.id, ingredient.name)} className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Retire ingredient">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Opening Stock */}
      <td className="py-3 px-2">
        <input
          type="number"
          step="0.001"
          min="0"
          value={opening}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOpeningChange(e.target.value)}
          placeholder="0.000"
          className="w-20 h-8 text-xs text-center bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
          aria-label={`Opening stock for ${ingredient.name}`}
        />
      </td>

      {/* Received Stock */}
      <td className="py-3 px-2">
        <input
          type="number"
          step="0.001"
          min="0"
          value={received}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReceivedChange(e.target.value)}
          placeholder="0.000"
          className="w-20 h-8 text-xs text-center bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
          aria-label={`Received stock for ${ingredient.name}`}
        />
      </td>

      {/* Consumed Stock */}
      <td className="py-3 px-2">
        <input
          type="number"
          step="0.001"
          min="0"
          value={consumed}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConsumedChange(e.target.value)}
          placeholder="0.000"
          className="w-20 h-8 text-xs text-center bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
          aria-label={`Consumed stock for ${ingredient.name}`}
        />
      </td>

      {/* Closing Stock */}
      <td className="py-3 px-2">
        <input
          type="number"
          step="0.001"
          min="0"
          value={closing}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleClosingChange(e.target.value)}
          placeholder="0.000"
          className="w-20 h-8 text-xs text-center bg-[oklch(0.12_0.01_260)] border border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] rounded-md"
          aria-label={`Closing stock for ${ingredient.name}`}
        />
      </td>

      {/* Wastage (computed) */}
      <td className="py-3 px-2 text-center">
        {computedWastage !== null ? (
          <span
            className={`text-xs font-mono ${
              parseFloat(computedWastage) > 0
                ? "text-amber-400"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {computedWastage}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-disabled)]">—</span>
        )}
      </td>

      {/* Forecasted Need */}
      <td className="py-3 px-2 text-center">
        {ingredient.hasForecast ? (
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {ingredient.forecastedNeed?.toFixed(3)}
          </span>
        ) : (
          <span
            className="text-xs text-[var(--text-disabled)] cursor-help"
            title="Forecast not yet generated. Runs daily at 6 PM."
          >
            —
          </span>
        )}
      </td>

      {/* Save button */}
      <td className="py-3 px-2 text-center">
        <div className="flex items-center justify-center gap-1 min-w-[64px]">
          {error && (
            <span
              className="text-[10px] text-red-400 max-w-[120px] truncate"
              title={error}
            >
              {error}
            </span>
          )}
          {success && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-emerald-400"
            >
              <Check className="w-4 h-4" />
            </motion.span>
          )}
          {saving ? (
            <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
          ) : (
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                isDirty
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-white/5 text-[var(--text-disabled)] cursor-not-allowed"
              }`}
              aria-label={`Save ${ingredient.name} stock`}
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}
