import type { Availability } from "@/types/menu";

const config: Record<Availability, { label: string; bg: string; text: string }> = {
  Available: { label: "Available", bg: "rgb(20,83,45)", text: "rgb(187,247,208)" },
  "Selling Fast": { label: "Selling Fast", bg: "rgb(113,63,18)", text: "rgb(254,240,138)" },
  "Sold Out": { label: "Sold Out", bg: "rgb(127,29,29)", text: "rgb(254,202,202)" },
};

interface Props {
  status: Availability;
}

export default function AvailabilityBadge({ status }: Props) {
  const cfg = config[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-white/10"
      style={{ background: cfg.bg, color: cfg.text, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {cfg.label}
    </span>
  );
}
