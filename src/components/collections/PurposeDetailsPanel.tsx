"use client";

import { useMemo } from "react";
import { inr, fmtDateDMY } from "@/lib/format";
import type {
  PurposeDetails,
  PurposePendingFlat,
  PurposeRecord,
} from "@/lib/payment-purposes-api";

const NO_OWNER_LABEL = "કોઈ માલિક નથી";

function displayOwnerName(ownerName?: string | null) {
  return (ownerName || "").trim() || NO_OWNER_LABEL;
}

function flatHasOwner(ownerName?: string | null, hasOwner?: boolean) {
  if (typeof hasOwner === "boolean") return hasOwner;
  return !!ownerName?.trim();
}

function isValidMobile(mobile?: string | null) {
  const digits = (mobile || "").replace(/\D/g, "");
  return digits.length === 10;
}

function reminderHref(purpose: PurposeRecord, flat: PurposePendingFlat) {
  const owner = displayOwnerName(flat.ownerName);
  const mobile = (flat.ownerMobile || "").replace(/\D/g, "");
  const message = `નમસ્તે ${owner},

આપના ફ્લેટ નંબર ${flat.flatNumber} માટે "${purpose.title}" ની ${inr(flat.pendingAmount)} રકમ હજુ બાકી છે.

કૃપા કરીને વહેલી તકે ચુકવણી કરવા વિનંતી.

આભાર.`;
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
}

const BADGE_COLORS = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function badgeColor(flatNumber: string) {
  let h = 0;
  for (let i = 0; i < flatNumber.length; i++) {
    h = (h + flatNumber.charCodeAt(i) * (i + 1)) % BADGE_COLORS.length;
  }
  return BADGE_COLORS[h];
}

function matchesSearch(q: string, flatNumber: string, ownerName?: string | null) {
  if (!q) return true;
  const hay = `${flatNumber} ${ownerName || ""}`.toLowerCase();
  return hay.includes(q);
}

interface Props {
  details: PurposeDetails | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  searchQuery?: string;
  /** all = paid+pending sections; paid | pending = one section */
  statusFilter?: "all" | "paid" | "pending";
  onClose: () => void;
  onAddCollection?: () => void;
}

export default function PurposeDetailsPanel({
  details,
  loading,
  error,
  isSuperAdmin,
  searchQuery = "",
  statusFilter = "all",
  onClose,
  onAddCollection,
}: Props) {
  const q = searchQuery.trim().toLowerCase();
  const showPaid = statusFilter === "all" || statusFilter === "paid";
  const showPending = statusFilter === "all" || statusFilter === "pending";

  const paid = useMemo(() => {
    if (!details) return [];
    return details.paid.filter((row) =>
      matchesSearch(q, row.flatNumber, row.ownerName)
    );
  }, [details, q]);

  const pending = useMemo(() => {
    if (!details) return [];
    // Sold + owner + unpaid only (server already filters; keep client guard)
    return details.pending.filter(
      (row) =>
        flatHasOwner(row.ownerName, row.hasOwner) &&
        row.pendingAmount > 0 &&
        matchesSearch(q, row.flatNumber, row.ownerName)
    );
  }, [details, q]);

  if (!details && !loading && !error) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-navy">
            {details?.purpose.title || "Purpose details"}
          </h2>
          {!!details?.purpose.description?.trim() && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
              {details.purpose.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isSuperAdmin && onAddCollection && (
            <button
              type="button"
              onClick={onAddCollection}
              className="text-xs font-semibold text-brand hover:underline"
            >
              + Add Collection
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-navy"
          >
            Close
          </button>
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm text-slate-400">Loading purpose details…</p>}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-600/50 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {details && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">કુલ ફ્લેટ</div>
              <div className="text-base font-bold tabular-nums text-navy dark:text-slate-50">
                {details.summary.totalFlats}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-600/50 dark:bg-emerald-950">
              <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">જમા થયેલ</div>
              <div className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                {details.summary.paidFlats}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-600/50 dark:bg-rose-950">
              <div className="text-[10px] font-medium text-rose-700 dark:text-rose-300">બાકી</div>
              <div className="text-base font-bold tabular-nums text-rose-800 dark:text-rose-200">
                {details.summary.pendingFlats}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 sm:col-span-1">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">કુલ જમા રકમ</div>
              <div className="text-sm font-bold tabular-nums text-brand">
                {inr(details.summary.totalCollected)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 sm:col-span-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">કુલ બાકી રકમ</div>
              <div className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {inr(details.summary.totalPending)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 col-span-2 sm:col-span-3">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Collection %</div>
              <div className="text-sm font-bold tabular-nums text-navy dark:text-slate-50">
                {details.summary.collectionPercent ?? 0}%
              </div>
            </div>
          </div>

          {/* Paid section */}
          {showPaid && (
          <div>
            <div className="mb-2 flex items-end justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                જમા થયેલ રકમ
              </h3>
              <div className="text-right text-[11px] text-slate-400">
                {paid.length} flats · {inr(details.summary.totalCollected)}
              </div>
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
              {paid.map((row) => {
                const hasOwner = flatHasOwner(row.ownerName, row.hasOwner);
                return (
                  <li key={row.paymentId || row.flatNumber} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={
                          "mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                          badgeColor(row.flatNumber)
                        }
                      >
                        {row.flatNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className={
                                "truncate font-bold " + (hasOwner ? "text-navy" : "text-slate-400")
                              }
                            >
                              {displayOwnerName(row.ownerName)}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="tabular-nums">{fmtDateDMY(row.paymentDate)}</span>
                              <span className="text-slate-300">·</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {row.paymentMode}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-base font-bold tabular-nums text-brand">
                            {inr(row.amount)}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-950 dark:text-emerald-300">
                            🟢 જમા
                          </span>
                          {!hasOwner && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              No Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {paid.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  હજુ કોઈ જમા નથી.
                </li>
              )}
            </ul>
          </div>
          )}

          {/* Pending section — Sold flats with owner only */}
          {showPending && (
          <div>
            <div className="mb-2 flex items-end justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">બાકી રકમ</h3>
              <div className="text-right text-[11px] text-slate-400">
                {pending.length} pending · {inr(details.summary.totalPending)}
              </div>
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
              {pending.map((row) => {
                const mobileOk = isValidMobile(row.ownerMobile);
                return (
                  <li key={row.flatId || row.flatNumber} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={
                          "mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                          badgeColor(row.flatNumber)
                        }
                      >
                        {row.flatNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-bold text-navy">
                              {displayOwnerName(row.ownerName)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">Flat {row.flatNumber}</div>
                          </div>
                          <div className="shrink-0 text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                            {inr(row.pendingAmount)}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:border-rose-600/50 dark:bg-rose-950 dark:text-rose-300">
                            🔴 બાકી
                          </span>
                          {isSuperAdmin &&
                            (mobileOk ? (
                              <a
                                href={reminderHref(details.purpose, row)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                              >
                                Send Reminder
                              </a>
                            ) : (
                              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                મોબાઇલ નંબર ઉપલબ્ધ નથી
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {pending.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-emerald-700 dark:text-emerald-300">
                  બધું ક્લિયર ✓ — કોઈ બાકી નથી.
                </li>
              )}
            </ul>
          </div>
          )}
        </>
      )}
    </section>
  );
}
