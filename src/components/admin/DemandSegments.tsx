"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  TooltipProps,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────

interface DepartmentSegment {
  department: string;
  orderCount: number;
  quantitySold: number;
}

interface DietarySegment {
  preference: string;
  orderCount: number;
  quantitySold: number;
}

interface DemandResponse {
  period: { from: string; to: string };
  byDepartment: DepartmentSegment[];
  byDietaryPreference: DietarySegment[];
}

// ── Chart colors (dark theme) ────────────────────────────────────

var DEPT_COLORS: Record<string, string> = {
  ICT: "oklch(0.62 0.19 250)",
  ET: "oklch(0.62 0.19 80)",
  BST: "oklch(0.55 0.20 300)",
};

var DIET_COLORS: Record<string, string> = {
  NON_VEGETARIAN: "oklch(0.55 0.20 15)",
  VEGETARIAN: "oklch(0.62 0.19 150)",
  VEGAN: "oklch(0.55 0.20 80)",
};

function CustomTooltip(
  props: TooltipProps<number, string> & { unit?: string }
) {
  var active = props.active;
  var payload = props.payload;
  var label = props.label;
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "oklch(0.15 0.012 260)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <p className="text-[var(--text-muted)]">{label}</p>
      <p className="text-[var(--brand)] font-bold">
        {payload[0]?.value} {props.unit || "orders"}
      </p>
    </div>
  );
}

var PIE_COLORS = ["oklch(0.62 0.19 250)", "oklch(0.62 0.19 80)", "oklch(0.55 0.20 300)", "oklch(0.55 0.20 15)"];

function PieTooltip(props: TooltipProps<number, string>) {
  var active = props.active;
  var payload = props.payload;
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "oklch(0.15 0.012 260)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <p className="text-[var(--text-muted)]">{payload[0]?.name}</p>
      <p className="text-[var(--brand)] font-bold">{payload[0]?.value} orders</p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export default function DemandSegments() {
  var _useState1 = useState<DemandResponse | null>(null);
  var data = _useState1[0];
  var setData = _useState1[1];
  var _useState2 = useState(true);
  var loading = _useState2[0];
  var setLoading = _useState2[1];
  var _useState3 = useState<string | null>(null);
  var error = _useState3[0];
  var setError = _useState3[1];

  useEffect(function () {
    fetch("/api/admin/analytics/demand-segments")
      .then(function (res) { return res.json(); })
      .then(function (json) { setData(json); setLoading(false); })
      .catch(function () { setError("Failed to load demand data."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <p className="text-xs text-red-400 text-center py-8">{error || "No data available."}</p>
      </div>
    );
  }

  var hasDepartmentData = data.byDepartment.length > 0;
  var hasDietaryData = data.byDietaryPreference.length > 0;

  if (!hasDepartmentData && !hasDietaryData) {
    return (
      <div
        className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <p className="text-xs text-[var(--text-muted)] text-center py-8">
          No order data available for this period.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)]"
      style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
    >
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
        Demand Segments
        <span className="ml-2 text-[10px] font-normal normal-case text-[var(--text-disabled)]">
          {data.period.from} — {data.period.to}
        </span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Department Bar Chart ── */}
        {hasDepartmentData && (
          <div>
            <h4 className="text-[11px] font-medium text-[var(--text-secondary)] mb-2">
              By Department
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.byDepartment}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.01 260)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.01 260)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip unit="orders" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="quantitySold" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {data.byDepartment.map(function (entry) {
                    return (
                      <Cell
                        key={entry.department}
                        fill={DEPT_COLORS[entry.department] || "oklch(0.62 0.19 250)"}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Dietary Preference Pie Chart ── */}
        {hasDietaryData && (
          <div>
            <h4 className="text-[11px] font-medium text-[var(--text-secondary)] mb-2">
              By Dietary Preference
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.byDietaryPreference.map(function (d) {
                    return { name: d.preference.replace(/_/g, " "), value: d.quantitySold };
                  })}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.byDietaryPreference.map(function (_entry, index) {
                    return (
                      <Cell key={"cell-" + index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    );
                  })}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Pie legend */}
            <div className="flex items-center justify-center gap-3 mt-2">
              {data.byDietaryPreference.map(function (d, i) {
                return (
                  <span key={d.preference} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {d.preference.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
