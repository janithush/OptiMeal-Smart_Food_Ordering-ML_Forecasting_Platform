import type { DietaryType } from "@/types/menu";

const badgeConfig: Record<DietaryType, { label: string; bg: string; text: string }> = {
  VEGAN: { label: "V", bg: "rgba(34,197,94,0.15)", text: "rgb(74,222,128)" },
  VEGETARIAN: { label: "VG", bg: "rgba(234,179,8,0.15)", text: "rgb(250,204,21)" },
  NON_VEGETARIAN: { label: "NV", bg: "rgba(239,68,68,0.15)", text: "rgb(248,113,113)" },
};

interface Props {
  type: DietaryType;
}

export default function DietaryBadge({ type }: Props) {
  const config = badgeConfig[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wider"
      style={{ background: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}
