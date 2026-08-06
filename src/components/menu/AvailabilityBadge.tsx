import type { Availability } from "@/types/menu";

const config: Record<Availability, { label: string; bg: string; text: string }> = {
  Available: { label: "Available", bg: "rgba(34,197,94,0.12)", text: "rgb(74,222,128)" },
  "Selling Fast": { label: "Selling Fast", bg: "rgba(234,179,8,0.15)", text: "rgb(250,204,21)" },
  "Sold Out": { label: "Sold Out", bg: "rgba(239,68,68,0.12)", text: "rgb(248,113,113)" },
};

interface Props {
  status: Availability;
}

export default function AvailabilityBadge({ status }: Props) {
  const cfg = config[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}
