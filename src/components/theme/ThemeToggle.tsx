"use client";

import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { springSnappy, fadeEase, HIT_SLOP } from "@/lib/motion";

/**
 * Theme toggle — cycles system → light → dark.
 * 36px visual with invisible 44pt hit-slop; icon crossfades on a spring.
 */
export default function ThemeToggle() {
  const { choice, resolved, cycle } = useTheme();

  // Static label: the icon is keyed by choice, and suppressHydrationWarning
  // covers the pre-paint theme script racing first render.
  const label = "Toggle color theme";

  return (
    <motion.button
      onClick={cycle}
      whileTap={{ scale: 0.96 }}
      title={label}
      aria-label={label}
      className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={choice === "system" ? `auto-${resolved}` : choice}
          suppressHydrationWarning
          initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
          transition={{ ...springSnappy, opacity: fadeEase }}
          className="flex items-center justify-center"
        >
          {choice === "system" ? (
            <MonitorSmartphone className="w-5 h-5 text-[var(--text-secondary)]" />
          ) : resolved === "light" ? (
            <Sun className="w-5 h-5 text-[var(--brand)]" />
          ) : (
            <Moon className="w-5 h-5 text-[var(--text-secondary)]" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
