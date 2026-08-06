"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItemData, PickupSlotData, DietaryType } from "@/types/menu";
import MenuItemCard from "@/components/menu/MenuItemCard";
import MenuItemDetail from "@/components/menu/MenuItemDetail";

interface Props {
  userName: string;
  items: MenuItemData[];
  slots: PickupSlotData[];
  userDietary: DietaryType | null;
}

type FilterValue = "All" | DietaryType;

const filterChips: { value: FilterValue; label: string }[] = [
  { value: "All", label: "All" },
  { value: "VEGAN", label: "Vegan 🌱" },
  { value: "VEGETARIAN", label: "Vegetarian 🥬" },
  { value: "NON_VEGETARIAN", label: "Non-Veg 🍗" },
];

export default function MenuPageContent({ userName, items, slots, userDietary }: Props) {
  const [filter, setFilter] = useState<FilterValue>(userDietary ?? "All");
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);

  const available = items.filter((i) => i.availability !== "Sold Out").length;
  const soldOut = items.filter((i) => i.availability === "Sold Out").length;

  const filteredItems = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((i) => i.dietaryType === filter);
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Today&apos;s Menu</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome, {userName} · {available} available · {soldOut} sold out
              </p>
            </div>
            <a
              href="/student/profile"
              className="w-9 h-9 rounded-full overflow-hidden bg-[oklch(0.15_0.01_260)] border border-[oklch(0.25_0.01_260)] flex items-center justify-center text-[var(--text-muted)] text-sm font-bold hover:border-[var(--brand)] transition-colors"
            >
              {userName.charAt(0).toUpperCase()}
            </a>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {filterChips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setFilter(chip.value)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filter === chip.value
                    ? "bg-[var(--brand)]/20 text-[var(--brand)] border border-[var(--brand)]/30"
                    : "bg-white/5 text-[var(--text-muted)] border border-transparent hover:border-white/10"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-muted)] text-sm">
              {filter === "All"
                ? "No menu items available today. Check back later!"
                : `No ${filter.toLowerCase().replace("_", " ")} items today.`}
            </p>
            {filter !== "All" && (
              <button onClick={() => setFilter("All")} className="mt-3 text-sm text-[var(--brand)] hover:underline">
                Show all items
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  <MenuItemCard item={item} onTap={setSelectedItem} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <MenuItemDetail
          item={selectedItem}
          slots={slots}
          onClose={() => setSelectedItem(null)}
          onAddToCart={() => {
            /* Story 3.3 */
          }}
        />
      )}
    </div>
  );
}
