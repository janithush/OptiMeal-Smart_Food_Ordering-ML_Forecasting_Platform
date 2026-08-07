"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  glowColor?: string;
}

export default function KpiCard({ label, value, subtitle, icon, trend, glowColor }: Props) {
  const [displayValue, setDisplayValue] = useState(String(value));
  const prevValue = useRef(String(value));

  useEffect(() => {
    if (String(value) !== prevValue.current) {
      prevValue.current = String(value);
      setDisplayValue(String(value));
    }
  }, [value]);

  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-[var(--text-disabled)]";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-border)",
      }}
    >
      {/* Glow accent */}
      {glowColor && (
        <div
          className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-20 -translate-y-1/2 translate-x-1/2"
          style={{ background: glowColor }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <motion.span
              key={displayValue}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold text-[var(--text-primary)]"
            >
              {displayValue}
            </motion.span>
            {trend && (
              <span className={`text-[10px] font-medium ${trendColor}`}>
                {trendIcon}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
