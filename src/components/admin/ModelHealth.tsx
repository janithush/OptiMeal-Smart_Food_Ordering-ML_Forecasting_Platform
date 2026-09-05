"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { fadeEase } from "@/lib/motion";
import { Loader2, AlertTriangle, Check, Cpu } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface ModelHealthRow {
  itemName: string;
  lastTrained: string | null;
  rowsUsed: number;
  mae: number | null;
  r2: number | null;
  rolledBack: boolean;
  modelVersion: string | null;
}

// ── Component ────────────────────────────────────────────────────

export default function ModelHealth() {
  const _useState1 = useState<ModelHealthRow[]>([]);
  const models = _useState1[0];
  const setModels = _useState1[1];
  const _useState2 = useState(true);
  const loading = _useState2[0];
  const setLoading = _useState2[1];

  useEffect(function () {
    fetch("/api/admin/analytics/model-health")
      .then(function (res) { return res.json(); })
      .then(function (json) { setModels(json.models); setLoading(false); })
      .catch(function () { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
        <p className="text-xs text-[var(--text-muted)] text-center py-6">No model data available yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeEase}
      className="rounded-2xl p-4 border border-[var(--border-subtle)] overflow-hidden"
      style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
    >
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
        <Cpu className="w-3.5 h-3.5 inline mr-1.5" />
        ML Model Health
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <th className="py-2 px-3 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Item</th>
              <th className="py-2 px-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Rows</th>
              <th className="py-2 px-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">MAE</th>
              <th className="py-2 px-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">R²</th>
              <th className="py-2 px-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {models.map(function (m) {
              let statusIcon;
              let statusText;
              let statusColor;
              if (m.rolledBack) {
                statusIcon = <AlertTriangle className="w-3.5 h-3.5 inline" />;
                statusText = "Rolled back";
                statusColor = "text-amber-400";
              } else if (m.lastTrained === null) {
                statusIcon = <Loader2 className="w-3.5 h-3.5 inline" />;
                statusText = "No model";
                statusColor = "text-[var(--text-disabled)]";
              } else {
                statusIcon = <Check className="w-3.5 h-3.5 inline" />;
                statusText = "Healthy";
                statusColor = "text-emerald-400";
              }
              return (
                <motion.tr
                  key={m.itemName}
                  className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={fadeEase}
                >
                  <td className="py-2 px-3">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{m.itemName}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      {m.rowsUsed > 0 ? m.rowsUsed : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      {m.mae !== null ? m.mae.toFixed(1) : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      {m.r2 !== null ? m.r2.toFixed(2) : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={"text-[11px] font-medium " + statusColor}>
                      {statusIcon} {statusText}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
