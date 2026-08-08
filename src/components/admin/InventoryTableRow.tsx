"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, Check, Loader2 } from "lucide-react";

export interface IngredientRowData {
  id: string;
  name: string;
  unit: string;
  openingStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  forecastedNeed: number | null;
  hasForecast: boolean;
}

interface Props {
  ingredient: IngredientRowData;
  date: string;
  onSaved: () => void;
}

export default function InventoryTableRow({ ingredient, date, onSaved }: Props) {
  const [opening, setOpening] = useState(
    ingredient.openingStock !== null ? String(ingredient.openingStock) : ""
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
    const c = parseFloat(closing);
    if (!isNaN(o) && !isNaN(c)) {
      return (o - c).toFixed(3);
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
  }, [opening, closing, ingredient.id, date, onSaved]);

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

  return (
    <motion.tr
      className="border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02] transition-colors"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Ingredient Name + Unit */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {ingredient.name}
          </span>
          <span className="text-[11px] text-[var(--text-disabled)]">
            ({ingredient.unit})
          </span>
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
