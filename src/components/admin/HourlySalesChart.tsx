"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from "recharts";

interface Props {
  data: { hour: string; orders: number; revenue: number }[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "oklch(0.15 0.012 260)", border: "1px solid var(--glass-border)" }}>
      <p className="text-[var(--text-muted)]">{label}</p>
      <p className="text-[var(--brand)] font-bold">{payload[0]?.value} orders</p>
      <p className="text-[var(--text-secondary)]">Rs.{payload[1]?.value?.toLocaleString()}</p>
    </div>
  );
}

export default function HourlySalesChart({ data }: Props) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Hourly Orders</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "oklch(0.55 0.01 260)" }} axisLine={false} tickLine={false} interval={1} />
          <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.01 260)" }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxOrders * 1.3)]} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="orders" fill="oklch(0.78 0.18 55)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
