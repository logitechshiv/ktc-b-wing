"use client";

import { useMemo, useState } from "react";
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

export type PendingScopeFilter = "all" | "sold" | "builder";

function isSoldPending(row: PurposePendingFlat) {
  const status = String(row.flatStatus || "");
  return status !== "available" && flatHasOwner(row.ownerName, row.hasOwner);
}

function isBuilderPending(row: PurposePendingFlat) {
  return row.flatStatus === "available";
}

interface Props {
  details: PurposeDetails | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  searchQuery?: string;
  /** paid | pending — when omitted / "all", show both lists */
  statusFilter?: "paid" | "pending" | "all";
  /** all = every mode; cash | bank | upi = paid records only */
  modeFilter?: "all" | "cash" | "bank" | "upi";
  /** When true, title/description are shown by the parent accordion */
  hideHeader?: boolean;
  onClose?: () => void;
  onAddCollection?: () => void;
}

export default function PurposeDetailsPanel({
  details,
  loading,
  error,
  isSuperAdmin,
  searchQuery = "",
  statusFilter = "all",
  modeFilter = "all",
  hideHeader = false,
  onAddCollection,
}: Props) {
  const [pendingScope, setPendingScope] = useState<PendingScopeFilter>("all");
  const q = searchQuery.trim().toLowerCase();
  const showPaid = statusFilter === "paid" || statusFilter === "all";
  const showPending = statusFilter === "pending" || statusFilter === "all";

  const paid = useMemo(() => {
    if (!details) return [];
    return details.paid.filter((row) => {
      const isBuilder = row.paymentSource === "builder";
      const searchName = isBuilder ? `Builder ${row.ownerName || ""}` : row.ownerName;
      if (!matchesSearch(q, row.flatNumber, searchName)) return false;
      if (modeFilter === "all") return true;
      return String(row.paymentMode || "").toLowerCase() === modeFilter;
    });
  }, [details, q, modeFilter]);

  const pending = useMemo(() => {
    if (!details) return [];
    return details.pending.filter((row) => {
      if (row.pendingAmount <= 0) return false;
      if (!matchesSearch(q, row.flatNumber, row.ownerName || "builder")) return false;

      if (pendingScope === "sold") return isSoldPending(row);
      if (pendingScope === "builder") return isBuilderPending(row);

      // All — unsold (builder) + sold/rent with owner
      if (isBuilderPending(row)) return true;
      return isSoldPending(row);
    });
  }, [details, q, pendingScope]);

  const pendingSummaryAmount = useMemo(
    () => pending.reduce((sum, row) => sum + (Number(row.pendingAmount) || 0), 0),
    [pending]
  );

  if (!details && !loading && !error) return null;

  return (
    <div className="space-y-4">
      <section
        className={
          hideHeader
            ? "space-y-4"
            : "space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
        }
      >
        {!hideHeader && (
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
        )}

        {isSuperAdmin && onAddCollection && details && !loading && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAddCollection}
              className="text-xs font-semibold text-brand hover:underline"
            >
              + Add Collection
            </button>
          </div>
        )}

        {loading && <p className="py-6 text-center text-sm text-slate-400">Loading purpose details…</p>}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-600/50 dark:bg-rose-950 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {details && !loading && (
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
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 sm:col-span-3">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Collection %</div>
              <div className="text-sm font-bold tabular-nums text-navy dark:text-slate-50">
                {details.summary.collectionPercent ?? 0}%
              </div>
            </div>
          </div>
        )}
      </section>

      {details && !loading && showPaid && (
        <section className="space-y-2">
          <div className="flex items-end justify-between gap-2 px-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              જમા થયેલ (Paid)
            </h3>
            <div className="text-right text-[11px] text-slate-400">
              {paid.length} flats · {inr(details.summary.totalCollected)}
            </div>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {paid.map((row) => {
              const isBuilder = row.paymentSource === "builder";
              const payerLabel = isBuilder ? "Builder" : displayOwnerName(row.ownerName);
              return (
                <li key={`paid-${row.paymentId || row.flatNumber}`} className="px-3 py-3 sm:px-4">
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
                          <div className="truncate font-bold text-navy">{payerLabel}</div>
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
                        {isBuilder && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-600/50 dark:bg-amber-950 dark:text-amber-300">
                            Builder
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {paid.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">હજુ કોઈ જમા નથી.</li>
            )}
          </ul>
        </section>
      )}

      {details && !loading && showPending && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                બાકી (Pending)
              </h3>
              <label className="inline-flex items-center">
                <span className="sr-only">Pending filter</span>
                <select
                  value={pendingScope}
                  onChange={(e) => setPendingScope(e.target.value as PendingScopeFilter)}
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 pr-6 text-[11px] font-medium text-slate-600 outline-none focus:border-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">All</option>
                  <option value="sold">Sold Flats</option>
                  <option value="builder">Builder (Unsold)</option>
                </select>
              </label>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              {pending.length} pending · {inr(pendingSummaryAmount)}
            </div>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {pending.map((row) => {
              const isUnsold = row.flatStatus === "available";
              const mobileOk = !isUnsold && isValidMobile(row.ownerMobile);
              return (
                <li key={`pending-${row.flatId || row.flatNumber}`} className="px-3 py-3 sm:px-4">
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
                            {isUnsold ? "Builder" : displayOwnerName(row.ownerName)}
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
                        {isUnsold && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                            Unsold
                          </span>
                        )}
                        {isSuperAdmin &&
                          !isUnsold &&
                          (mobileOk ? (
                            <a
                              href={reminderHref(details.purpose, row)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                            >
                              WhatsApp Reminder
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
        </section>
      )}
    </div>
  );
}
