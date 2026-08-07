"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Plus, Trash2, Loader2 } from "lucide-react";

interface IngredientRow {
  ingredientId: string;
  name: string;
  unit: string;
  quantityPerPortion: number;
}

interface FormData {
  name: string;
  description: string;
  basePrice: number;
  dietaryType: string;
  imageUrl: string;
  isActive: boolean;
  ingredients: { ingredientId: string; quantityPerPortion: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: FormData;
  mode: "create" | "edit";
  allIngredients: { id: string; name: string; unit: string }[];
}

export default function MenuItemForm({ isOpen, onClose, onSave, initial, mode, allIngredients }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 0);
  const [dietaryType, setDietaryType] = useState(initial?.dietaryType ?? "VEGETARIAN");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [ingredients, setIngredients] = useState<(IngredientRow & { isNew: boolean })[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDescription(initial.description);
      setBasePrice(initial.basePrice);
      setDietaryType(initial.dietaryType);
      setImageUrl(initial.imageUrl);
      setIsActive(initial.isActive);

      // Map existing ingredients
      const rows = (initial.ingredients || []).map((i) => {
        const match = allIngredients.find((ai) => ai.id === i.ingredientId);
        return {
          ingredientId: i.ingredientId,
          name: match?.name ?? "Unknown",
          unit: match?.unit ?? "kg",
          quantityPerPortion: i.quantityPerPortion,
          isNew: false,
        };
      });
      setIngredients(rows);
    }
  }, [initial, allIngredients]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setError("Image too large (max 500KB)");
      return;
    }
    setImageSize(file.size);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAddIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { ingredientId: "", name: "", unit: "kg", quantityPerPortion: 0, isNew: true },
    ]);
  };

  const handleIngredientChange = (index: number, field: string, value: string | number) => {
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== index) return ing;
        if (field === "ingredientId") {
          const match = allIngredients.find((ai) => ai.id === value);
          return { ...ing, ingredientId: String(value), name: match?.name ?? "", unit: match?.unit ?? "kg" };
        }
        return { ...ing, [field]: value };
      })
    );
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (basePrice <= 0) { setError("Price must be > 0"); return; }

    // Validate ingredients have IDs
    const invalidIngredients = ingredients.filter((i) => !i.ingredientId);
    if (invalidIngredients.length > 0) {
      setError("All ingredients must have a selected item");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || "",
        basePrice,
        dietaryType,
        imageUrl,
        isActive,
        ingredients: ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          quantityPerPortion: i.quantityPerPortion,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const dietaryOptions = [
    { value: "VEGAN", label: "Vegan 🌱" },
    { value: "VEGETARIAN", label: "Vegetarian 🥬" },
    { value: "NON_VEGETARIAN", label: "Non-Veg 🍗" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 pb-8 max-h-[90vh] overflow-y-auto"
          style={{
            background: "oklch(0.12 0.01 260)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {mode === "create" ? "New Menu Item" : "Edit Menu Item"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]/50"
                placeholder="e.g. Rice & Curry"
              />
            </div>

            {/* Price + Dietary row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Price (Rs.) *</label>
                <input
                  type="number"
                  value={basePrice || ""}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Dietary Type</label>
                <select
                  value={dietaryType}
                  onChange={(e) => setDietaryType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]/50"
                >
                  {dietaryOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[oklch(0.12_0.01_260)]">{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]/50 resize-none"
                placeholder="Brief description..."
              />
            </div>

            {/* Image */}
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] border border-white/10 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </button>
                {imageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={imageUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                    <button onClick={() => { setImageUrl(""); setImageSize(0); }} className="text-[10px] text-red-400 hover:underline">Remove</button>
                  </div>
                )}
                {imageSize > 0 && <span className="text-[10px] text-[var(--text-disabled)]">{(imageSize / 1024).toFixed(0)}KB</span>}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Active</span>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`w-10 h-5 rounded-full transition-colors relative ${isActive ? "bg-[var(--brand)]" : "bg-white/10"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Ingredients</label>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="flex items-center gap-1 text-[10px] text-[var(--brand)] hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {ingredients.length === 0 && (
                <p className="text-[10px] text-[var(--text-disabled)]">No ingredients yet</p>
              )}
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <select
                    value={ing.ingredientId}
                    onChange={(e) => handleIngredientChange(i, "ingredientId", e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-[var(--text-primary)]"
                  >
                    <option value="">Select ingredient...</option>
                    {allIngredients.map((ai) => (
                      <option key={ai.id} value={ai.id} className="bg-[oklch(0.12_0.01_260)]">{ai.name} ({ai.unit})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ing.quantityPerPortion || ""}
                    onChange={(e) => handleIngredientChange(i, "quantityPerPortion", Number(e.target.value))}
                    step="0.001"
                    min="0"
                    placeholder="Qty"
                    className="w-16 px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-[var(--text-primary)]"
                  />
                  <span className="text-[10px] text-[var(--text-disabled)]">{ing.unit || "kg"}</span>
                  <button onClick={() => handleRemoveIngredient(i)} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Save */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-[var(--brand)] text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Saving..." : mode === "create" ? "Create Item" : "Save Changes"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
