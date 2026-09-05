"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { MenuItemData } from "@/types/menu";
import DietaryBadge from "./DietaryBadge";
import AvailabilityBadge from "./AvailabilityBadge";

interface Props {
  item: MenuItemData;
  onTap: (item: MenuItemData) => void;
}

export default function MenuItemCard({ item, onTap }: Props) {
  const isSoldOut = item.availability === "Sold Out";
  const hasSpecial = item.specialPrice !== null && item.specialPrice < item.basePrice;

  const initials = item.name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2);

  const gradientColors: Record<string, string[]> = {
    VEGAN: ["#166534", "#22c55e"],
    VEGETARIAN: ["#713f12", "#eab308"],
    NON_VEGETARIAN: ["#7f1d1d", "#ef4444"],
  };

  const [from, to] = gradientColors[item.dietaryType] ?? ["#1e293b", "#334155"];

  return (
    <motion.button
      onClick={() => onTap(item)}
      disabled={isSoldOut}
      whileTap={{ scale: 0.96 }}
      className="w-full text-left rounded-2xl overflow-hidden"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
        opacity: isSoldOut ? 0.5 : 1,
        cursor: isSoldOut ? "not-allowed" : "pointer",
      }}
    >
      {/* Image / Placeholder */}
      <div className="relative h-32 overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${from}40, ${to}60)` }}
          >
            <span className="text-4xl font-bold text-white/20">{initials}</span>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <DietaryBadge type={item.dietaryType} />
          {hasSpecial && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-white/10" style={{ background: "rgb(88,28,135)", color: "rgb(233,213,255)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              SPECIAL
            </span>
          )}
          {item.allergenMatch.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400" title={item.allergenMatch.join(", ")}>
              ⚠️
            </span>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5">
          <AvailabilityBadge status={item.availability} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.name}</h3>
          <div className="text-right shrink-0">
            {hasSpecial ? (
              <>
                <span className="text-xs text-[var(--text-disabled)] line-through mr-1">Rs.{item.basePrice}</span>
                <span className="text-sm font-bold text-[var(--brand)]">Rs.{item.specialPrice}</span>
              </>
            ) : (
              <span className="text-sm font-bold text-[var(--brand)]">Rs.{item.basePrice}</span>
            )}
          </div>
        </div>
        {item.description && (
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{item.description}</p>
        )}
      </div>
    </motion.button>
  );
}
