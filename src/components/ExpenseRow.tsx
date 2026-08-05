"use client";
import type { Expense } from "@/lib/types";
import { inr, fmtDateDMY } from "@/lib/format";

function shareText(e: Expense) {
  return `KCT-3 B-Wing Expense\n${e.category}: ${e.name}\nAmount: ${inr(e.amount)}\nDate: ${fmtDateDMY(e.date)}${e.note ? `\nNote: ${e.note}` : ""}`;
}

export default function ExpenseRow({ expense: e, compact = false }: { expense: Expense; compact?: boolean }) {
  const waHref = "https://wa.me/?text=" + encodeURIComponent(shareText(e));

  return (
    <li className={compact ? "px-4 py-3" : "px-4 py-3.5"}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              {e.category}
            </span>
            <span className="min-w-0 text-sm font-bold text-navy">{e.name}</span>
          </div>
        </div>
        <div className="shrink-0 text-sm font-bold tabular-nums text-rose-500">{inr(e.amount)}</div>
      </div>

      <div className={"mt-2 flex flex-wrap items-center gap-2 " + (compact ? "justify-between" : "justify-between")}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="tabular-nums">{fmtDateDMY(e.date)}</span>
          {e.hasBill && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M8 3h6l4 4v14H8z" />
                <path d="M14 3v4h4M10 12h6M10 16h6" />
              </svg>
              Bill
            </span>
          )}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
            {e.paidFrom}
          </span>
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
            >
              <span aria-hidden>🟢</span>
              Share to Group
            </a>
            {e.sharedToGroup ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Sent
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600">
                Pending
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
