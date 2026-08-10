"use client";

import { fmtDate } from "@/lib/format";
import type { NoticeCategory } from "@/lib/types";

export interface NoticeCardData {
  id: string;
  title: string;
  body: string;
  description?: string;
  category?: NoticeCategory;
  date: string;
  pinned?: boolean;
}

const CATEGORY_META: Record<
  NoticeCategory,
  { label: string; className: string }
> = {
  general: { label: "General", className: "border-slate-200 bg-slate-50 text-slate-600" },
  maintenance: { label: "Maintenance", className: "border-amber-200 bg-amber-50 text-amber-700" },
  event: { label: "Event", className: "border-violet-200 bg-violet-50 text-violet-700" },
  payment: { label: "Payment", className: "border-brand/25 bg-brand/10 text-brand" },
  urgent: { label: "Urgent", className: "border-rose-200 bg-rose-50 text-rose-600" },
};

export function noticeCategoryMeta(category: NoticeCategory) {
  return CATEGORY_META[category];
}

export default function NoticeCard({
  notice,
  compact = false,
  expanded = false,
  onToggle,
}: {
  notice: NoticeCardData;
  compact?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const category = notice.category || "general";
  const meta = CATEGORY_META[category];
  const body = (notice.description || notice.body || "").trim();
  const preview =
    compact && body.length > 90 && !expanded ? body.slice(0, 90).trimEnd() + "…" : body;

  const shareHref =
    "https://wa.me/?text=" +
    encodeURIComponent(`KCT-3 B-Wing Notice\n\n${notice.title}\n\n${body}\n\n— ${fmtDate(notice.date)}`);

  return (
    <article
      className={
        "relative overflow-hidden rounded-2xl border bg-white shadow-sm " +
        (category === "urgent"
          ? "border-rose-100"
          : notice.pinned
            ? "border-brand/20"
            : "border-slate-100")
      }
    >
      {notice.pinned && (
        <div className="absolute right-3 top-3 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
          Pinned
        </div>
      )}

      <div className={compact ? "p-3.5" : "p-4"}>
        <div className="flex flex-wrap items-center gap-2 pr-14">
          <span className={"rounded-full border px-2.5 py-0.5 text-[11px] font-semibold " + meta.className}>
            {meta.label}
          </span>
          <span className="text-[11px] tabular-nums text-slate-400">{fmtDate(notice.date)}</span>
        </div>

        <h3 className={"mt-2 font-bold text-navy " + (compact ? "text-sm" : "text-[15px]")}>{notice.title}</h3>
        <p className={"mt-1.5 leading-relaxed text-slate-600 " + (compact ? "text-xs" : "text-sm")}>{preview}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onToggle && body.length > 90 && (
            <button
              type="button"
              onClick={onToggle}
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
          >
            <span aria-hidden>🟢</span>
            Share
          </a>
        </div>
      </div>
    </article>
  );
}
