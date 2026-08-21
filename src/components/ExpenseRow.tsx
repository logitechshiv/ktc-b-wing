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

  return (
    <li
      draggable={canReorder}
      onDragStart={canReorder ? onDragStart : undefined}
      onDragOver={canReorder ? onDragOver : undefined}
      onDragLeave={canReorder ? onDragLeave : undefined}
      onDrop={canReorder ? onDrop : undefined}
      onDragEnd={canReorder ? onDragEnd : undefined}
      className={
        (compact ? "px-4 py-3" : "px-4 py-3.5") +
        " transition-all duration-200 " +
        (isDragging ? "cursor-grabbing opacity-50 scale-[0.99] bg-slate-50" : "") +
        (isDragOver && !isDragging ? " border-t-2 border-brand bg-brand/[0.03]" : "")
      }
    >
      <div className="flex items-start gap-2">
        {canReorder && (
          <span
            aria-hidden
            title="Drag to reorder"
            className="mt-0.5 shrink-0 cursor-grab touch-none select-none rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <circle cx="7" cy="5" r="1.4" />
              <circle cx="13" cy="5" r="1.4" />
              <circle cx="7" cy="10" r="1.4" />
              <circle cx="13" cy="10" r="1.4" />
              <circle cx="7" cy="15" r="1.4" />
              <circle cx="13" cy="15" r="1.4" />
            </svg>
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              {e.category}
            </span>
            {e.expenseType === "common" || e.expenseType === "general" ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                {e.expenseType === "common" ? "Common Expense" : "General Expense"}
              </span>
            ) : null}
            <span className="min-w-0 text-sm font-bold text-navy">{e.name}</span>
          </div>
          {e.note?.trim() ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-snug text-slate-500">
              <span className="font-medium text-slate-500">નોંધ:</span> {e.note.trim()}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-sm font-bold tabular-nums text-rose-500">{inr(e.amount)}</div>
      </div>

      <div
        className={
          "mt-2 flex flex-wrap items-center gap-2 justify-between " + (canReorder ? "pl-7" : "")
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="tabular-nums">{fmtDateDMY(e.date)}</span>
          {(hasBill) &&
            (billUrls.length > 0 ? (
              billUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                  title={billUrls.length > 1 ? `View bill ${index + 1}` : "View bill"}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
          {/* {pay && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              {pay}
            </span>
          )} */}
          {method && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {method}
              {e.expenseMethod === "collection" && e.purposeName ? ` · ${e.purposeName}` : ""}
            </span>
          )}
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onWhatsappShare?.()}
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
            {isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}