const TONES = {
  violet: { bg: "#F3EEFF", value: "#5B4B8A" },
  green: { bg: "#EAF8EF", value: "#1F7A45" },
  rose: { bg: "#FDECEE", value: "#C0392B" },
  amber: { bg: "#FFF6E5", value: "#9A6B16" },
  sky: { bg: "#EAF4FC", value: "#1D6FA5" },
  cyan: { bg: "#E8F7F8", value: "#0F7C82" },
  orange: { bg: "#FFF0E6", value: "#C45C1A" },
  teal: { bg: "#E7F7F3", value: "#0F766E" },
  pink: { bg: "#FCEEF2", value: "#B43B5C" },
} as const;

export type SummaryTone = keyof typeof TONES;

export default function SummaryTile({
  value,
  label,
  icon,
  tone,
}: {
  value: string;
  label: string;
  icon: string;
  tone: SummaryTone;
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-2xl px-3 py-3" style={{ backgroundColor: t.bg }}>
      <div className="text-[1.35rem] font-extrabold tabular-nums leading-none tracking-tight sm:text-[1.5rem]" style={{ color: t.value }}>
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-sm leading-none" aria-hidden>
          {icon}
        </span>
        <span className="text-[11px] font-medium leading-none text-slate-500">{label}</span>
      </div>
    </div>
  );
}
