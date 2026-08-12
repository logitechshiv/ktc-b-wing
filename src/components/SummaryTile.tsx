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
  wide = false,
}: {
  value: string;
  label: string;
  icon: string;
  tone: SummaryTone;
  /** Full-width hero tile */
  wide?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div
      className={
        "min-w-0 w-full overflow-hidden rounded-2xl " +
        (wide
          ? "flex items-center justify-between gap-3 px-4 py-4"
          : "px-2.5 py-3 min-[480px]:px-3.5 min-[480px]:py-3.5")
      }
      style={{ backgroundColor: t.bg }}
    >
      <div className="min-w-0">
        <div
          className={
            "break-words font-extrabold tabular-nums tracking-tight " +
            (wide
              ? "text-[1.5rem] leading-none min-[380px]:text-[1.75rem] sm:text-[2rem]"
              : "text-[0.95rem] leading-tight min-[380px]:text-[1.1rem] sm:text-[1.35rem]")
          }
          style={{ color: t.value }}
        >
          {value}
        </div>
        <div className={"flex items-start gap-1 " + (wide ? "mt-2 gap-1.5" : "mt-2 min-[480px]:mt-2.5")}>
          <span className="mt-0.5 shrink-0 text-sm leading-none" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0 break-words text-[11px] font-medium leading-snug text-slate-500 min-[480px]:text-[12px]">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
