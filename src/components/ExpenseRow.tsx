"use client";

import type { DragEvent } from "react";
import { inr, fmtDateDMY } from "@/lib/format";

export interface ExpenseRowData {
  id: string;
  category: string;
  /** general | common — optional for legacy rows */
  expenseType?: "general" | "common" | string;
  name: string;
  amount: number;
  date: string;
  note?: string;
  /** Legacy mock field (cash | bank) */
  paidFrom?: string;
  paymentMethod?: string;
  expenseMethod?: "fund" | "collection" | string;
  purposeName?: string;
  hasBill?: boolean;
  billUrl?: string;
  billUrls?: string[];
  sharedToGroup?: boolean;
  displayOrder?: number;
}

function methodLabel(method?: string) {
  if (method === "collection") return "ઉઘરાણી";
  if (method === "fund") return "Fund";
  return method || "";
}

function paymentLabel(e: ExpenseRowData) {
  return (e.paymentMethod || e.paidFrom || "").toUpperCase();
}

function buildShareText(e: ExpenseRowData) {
  const lines = [
    "📢 ખર્ચની માહિતી",
    "",
    "ખર્ચ:",
    e.name,
    "",
    "કેટેગરી:",
    e.category,
    "",
    "રકમ:",
    inr(e.amount),
    "",
    "તારીખ:",
    fmtDateDMY(e.date),
    "",
    "ચુકવણી પ્રકાર:",
    paymentLabel(e) || "—",
  ];

  if (e.expenseMethod === "collection" && e.purposeName) {
    lines.push("", "પર્પઝ:", e.purposeName);
  }

  if (e.note) {
    lines.push("", "નોંધ:", e.note);
  }

  return lines.join("\n");
}

interface Props {
  expense: ExpenseRowData;
  compact?: boolean;
  isSuperAdmin?: boolean;
  canReorder?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onWhatsappShare?: () => void;
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void;
  onDragOver?: (e: DragEvent<HTMLLIElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLLIElement>) => void;
  onDrop?: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLLIElement>) => void;
}

export default function ExpenseRow({
  expense: e,
  compact = false,
  isSuperAdmin = false,
  canReorder = false,
  isDragging = false,
  isDragOver = false,
  onEdit,
  onDelete,
  onWhatsappShare,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: Props) {
  const waHref = "https://wa.me/?text=" + encodeURIComponent(buildShareText(e));
  const pay = paymentLabel(e);
  const method = methodLabel(e.expenseMethod);
  const billUrls =
    e.billUrls && e.billUrls.length > 0
      ? e.billUrls
      : e.billUrl
        ? [e.billUrl]
        : [];
  const hasBill = e.hasBill || billUrls.length > 0;

  const rawNote = e.note?.trim();
  const displayNote = rawNote
    ? rawNote.startsWith("નોંધ:")
      ? rawNote
      : `નોંધ: ${rawNote}`
    : null;

  if (compact) {
    return (
      <li className="px-4 py-3 transition hover:bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                {e.category}
              </span>
              <span className="truncate text-xs font-bold text-navy">{e.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="tabular-nums">{fmtDateDMY(e.date)}</span>
              {hasBill && (
                <span className="inline-flex items-center gap-1 font-medium text-sky-600">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3h6l4 4v14H8z" />
                    <path d="M14 3v4h4M10 12h6M10 16h6" />
                  </svg>
                  Bill
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-xs font-bold tabular-nums text-rose-500">
            {inr(e.amount)}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      draggable={canReorder}
      onDragStart={canReorder ? onDragStart : undefined}
      onDragOver={canReorder ? onDragOver : undefined}
      onDragLeave={canReorder ? onDragLeave : undefined}
      onDrop={canReorder ? onDrop : undefined}
      onDragEnd={canReorder ? onDragEnd : undefined}
      className={
        "px-4 py-3.5 sm:px-5 transition-colors hover:bg-slate-50/60 " +
        (isDragging ? "cursor-grabbing opacity-50 scale-[0.99] bg-slate-50" : "") +
        (isDragOver && !isDragging ? " border-t-2 border-brand bg-brand/[0.03]" : "")
      }
    >
      {/* Top Row: Category Badges + Expense Title + Amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
            {e.category}
          </span>
          {e.expenseType === "common" || e.expenseType === "general" ? (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {e.expenseType === "common" ? "Common Expense" : "General Expense"}
            </span>
          ) : null}
          <h3 className="text-sm font-bold text-navy sm:text-base leading-snug">
            {e.name}
          </h3>
        </div>

        <div className="shrink-0 text-base font-bold tabular-nums text-rose-500 sm:text-lg">
          {inr(e.amount)}
        </div>
      </div>

      {/* Middle Row: Note (Fully visible with line breaks) */}
      {displayNote && (
        <div className="mt-2 whitespace-pre-line text-xs font-medium leading-relaxed text-slate-600">
          {displayNote}
        </div>
      )}

      {/* Bottom Row: Date & Bill (Left) + Actions & Status (Right) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="tabular-nums font-medium">{fmtDateDMY(e.date)}</span>
          {hasBill &&
            (billUrls.length > 0 ? (
              billUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline"
                  title={billUrls.length > 1 ? `View bill ${index + 1}` : "View bill"}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M8 3h6l4 4v14H8z" />
                    <path d="M14 3v4h4M10 12h6M10 16h6" />
                  </svg>
                  {billUrls.length > 1 ? `Bill ${index + 1}` : "Bill"}
                </a>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M8 3h6l4 4v14H8z" />
                  <path d="M14 3v4h4M10 12h6M10 16h6" />
                </svg>
                Bill
              </span>
            ))}

          {method && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {method}
              {e.expenseMethod === "collection" && e.purposeName ? ` · ${e.purposeName}` : ""}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onWhatsappShare?.()}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 shadow-2xs hover:bg-emerald-50 transition"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Share to Group
          </a>

          {e.sharedToGroup ? (
            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Sent
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              Pending
            </span>
          )}

          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}