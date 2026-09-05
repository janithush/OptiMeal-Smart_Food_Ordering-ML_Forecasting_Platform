import type { Transition, Variants } from "motion/react";

/**
 * CaféSmart motion tokens — Apple-HIG physics (Grill-approved).
 * - snappy: chips, buttons, pills, small feedback (stiffness 400 / damping 30)
 * - gentle: sheets, modals, drawers, large panels (stiffness 260 / damping 28)
 * - fade: opacity-only transitions use a short ease (springs look floaty on fades)
 * - tap: universal tactile press feedback (whileTap)
 */

// ── Springs ──────────────────────────────────────────────────────────────
export const springSnappy: Transition = { type: "spring", stiffness: 400, damping: 30 };
export const springGentle: Transition = { type: "spring", stiffness: 260, damping: 28 };

/** Opacity-only fades: eased tween (carve-out — springs overshoot on fades). */
export const fadeEase: Transition = { duration: 0.18, ease: "easeOut" };

/** Universal press feedback. Safe on disabled controls (motion suppresses it). */
export const tapFeedback = { scale: 0.96 } as const;

// ── Sheet / modal lifecycle (spec values) ────────────────────────────────
export const sheetVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { y: springGentle, scale: springGentle, opacity: fadeEase },
  },
  gone: { opacity: 0, y: 15, scale: 0.98, transition: fadeEase },
};

// ── Staggered reveals (capped — long lists must not cascade forever) ─────
export const listContainer: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { y: springSnappy, opacity: fadeEase },
  },
  gone: { opacity: 0, scale: 0.96, transition: fadeEase },
};

// ── 44pt hit-slop ────────────────────────────────────────────────────────
// Keeps 32–36px visuals while expanding the invisible tap area to ≥44px.
// Tailwind v4 picks these literals up from this file during scanning.
export const HIT_SLOP =
  "relative after:absolute after:-inset-1.5 after:content-['']" as const;
