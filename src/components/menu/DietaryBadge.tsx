import type { DietaryType } from "@/types/menu";

const badgeConfig: Record<DietaryType, { label: string; bg: string; text: string }> = {
  VEGAN: { label: "V", bg: "rgb(22,101,52)", text: "rgb(187,247,208)" },
  VEGETARIAN: { label: "VG", bg: "rgb(113,63,18)", text: "rgb(254,240,138)" },
  NON_VEGETARIAN: { label: "NV", bg: "rgb(127,29,29)", text: "rgb(254,202,202)" },
};

interface Props {
  type: DietaryType;
}

export default function DietaryBadge({ type }: Props) {
  const config = badgeConfig[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wider border border-white/10"
      style={{ background: config.bg, color: config.text, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {config.label}
    </span>
  );
}
