"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, ToggleLeft, ToggleRight, Loader2, Utensils, Tag, Trash2, Sparkles, Check } from "lucide-react";
import MenuItemForm from "@/components/admin/MenuItemForm";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DailySpecialModal from "@/components/admin/DailySpecialModal";

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  dietaryType: string;
  imageUrl: string | null;
  isActive: boolean;
  ingredients: { ingredientId: string; name: string; unit: string; quantityPerPortion: number }[];
  todaySpecial: { id: string; specialPrice: number; description: string | null } | null;
}

interface IngredientData {
  id: string;
  name: string;
  unit: string;
}

const dietaryBadge: Record<string, string> = {
  VEGAN: "🌱 Vegan",
  VEGETARIAN: "🥬 Veg",
  NON_VEGETARIAN: "🍗 Non-Veg",
};

export default function AdminMenuClient({ userName }: { userName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItemData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItemData | null>(null);
  const [specialTarget, setSpecialTarget] = useState<MenuItemData | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/menu");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ingredients");
      if (res.ok) {
        const data = await res.json();
        setIngredients(data.ingredients ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Fetch in an async IIFE so the setState call sits behind an `await`.
    // React Compiler's set-state-in-effect rule allows setState after
    // an await (it's no longer "synchronous" within the effect body).
    (async () => {
      await Promise.all([fetchMenu(), fetchIngredients()]);
      setLoading(false);
    })();
  }, [fetchMenu, fetchIngredients]);

  // ── CRUD Handlers ──────────────────────────────────────────────

  const handleCreate = async (data: {
    name: string;
    description: string;
    basePrice: number;
    dietaryType: string;
    imageUrl: string;
    isActive: boolean;
    ingredients: { ingredientId: string; quantityPerPortion: number }[];
  }) => {
    const res = await fetch("/api/admin/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create");
    }
    setFormOpen(false);
    showToast(`"${data.name}" created`);
    await fetchMenu();
    await fetchIngredients();
  };

  const handleUpdate = async (data: {
    name: string;
    description: string;
    basePrice: number;
    dietaryType: string;
    imageUrl: string;
    isActive: boolean;
    ingredients: { ingredientId: string; quantityPerPortion: number }[];
  }) => {
    if (!editItem) return;
    const res = await fetch(`/api/admin/menu/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to update");
    }
    setEditItem(null);
    setFormOpen(false);
    showToast(`"${data.name}" updated`);
    await fetchMenu();
    await fetchIngredients();
  };

  const handleToggleActive = async (item: MenuItemData) => {
    await fetch(`/api/admin/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    showToast(`"${item.name}" ${!item.isActive ? "activated" : "deactivated"}`);
    await fetchMenu();
  };

  const handleToggleDailySpecial = async (item: MenuItemData) => {
    if (item.todaySpecial) {
      const res = await fetch(`/api/admin/menu/${item.id}/daily-special`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Daily special removed from "${item.name}"`);
        await fetchMenu();
      } else {
        showToast("Failed to remove daily special", "error");
      }
    } else {
      setSpecialTarget(item);
    }
  };

  const handleDailySpecialConfirm = async (specialPrice: number) => {
    if (!specialTarget) return;
    const res = await fetch(`/api/admin/menu/${specialTarget.id}/daily-special`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specialPrice, description: null }),
    });
    if (res.ok) {
      showToast(`Daily special set: Rs.${specialPrice} for "${specialTarget.name}"`);
      await fetchMenu();
    } else {
      const err = await res.json();
      showToast(err.error ?? "Failed to set daily special", "error");
    }
    setSpecialTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const itemName = deleteTarget.name;
    const res = await fetch(`/api/admin/menu/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast(`"${itemName}" deleted`);
    } else {
      showToast(`Failed to delete "${itemName}"`, "error");
    }
    setDeleteTarget(null);
    await fetchMenu();
  };

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
            style={{
              background: toast.type === "success" ? "oklch(0.15 0.04 160)" : "oklch(0.15 0.04 20)",
              border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
            }}
          >
            {toast.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm ${toast.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/admin/dashboard")} className="p-1">
                <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Menu Management</h1>
                <p className="text-xs text-[var(--text-muted)]">
                  {items.length} items · {activeCount} active
                </p>
              </div>
            </div>
            <button
              onClick={() => { setEditItem(null); setFormOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand)] text-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Item list */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Utensils className="w-10 h-10 text-[var(--text-disabled)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No menu items yet</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1">Add your first item above</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "var(--glass-blur)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Utensils className="w-5 h-5 text-[var(--text-disabled)]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</span>
                        {!item.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">Inactive</span>
                        )}
                        {item.todaySpecial && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium border border-purple-500/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Special Rs.{item.todaySpecial.specialPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${item.todaySpecial ? "text-[var(--text-disabled)] line-through" : "text-[var(--brand)]"}`}>
                          Rs.{item.basePrice}
                        </span>
                        {item.todaySpecial && (
                          <span className="text-xs font-bold text-purple-400">Rs.{item.todaySpecial.specialPrice}</span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)]">{dietaryBadge[item.dietaryType] ?? item.dietaryType}</span>
                      </div>
                      {item.ingredients.length > 0 && (
                        <p className="text-[10px] text-[var(--text-disabled)] truncate">
                          {item.ingredients.map((i) => i.name).join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* Active/Inactive toggle */}
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title={item.isActive ? "Deactivate" : "Activate"}
                      >
                        {item.isActive ? (
                          <ToggleRight className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-[var(--text-disabled)]" />
                        )}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => { setEditItem(item); setFormOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        title="Edit item"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Daily Special toggle */}
                      <button
                        onClick={() => handleToggleDailySpecial(item)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.todaySpecial
                            ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                            : "hover:bg-white/10 text-[var(--text-disabled)] hover:text-purple-400"
                        }`}
                        title={item.todaySpecial ? "Remove daily special" : "Set daily special"}
                      >
                        <Tag className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-disabled)] hover:text-red-400 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <MenuItemForm
        key={editItem?.id ?? "new"}
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(null); }}
        onSave={editItem ? handleUpdate : handleCreate}
        initial={editItem ? {
          name: editItem.name,
          description: editItem.description ?? "",
          basePrice: editItem.basePrice,
          dietaryType: editItem.dietaryType,
          imageUrl: editItem.imageUrl ?? "",
          isActive: editItem.isActive,
          ingredients: editItem.ingredients.map((i) => ({ ingredientId: i.ingredientId, quantityPerPortion: i.quantityPerPortion })),
        } : undefined}
        mode={editItem ? "edit" : "create"}
        allIngredients={ingredients}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Menu Item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Daily Special Modal */}
      <DailySpecialModal
        isOpen={specialTarget !== null}
        itemName={specialTarget?.name ?? ""}
        basePrice={specialTarget?.basePrice ?? 0}
        onConfirm={handleDailySpecialConfirm}
        onCancel={() => setSpecialTarget(null)}
      />
    </div>
  );
}
