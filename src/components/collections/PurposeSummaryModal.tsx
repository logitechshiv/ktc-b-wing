"use client";

import { useMemo } from "react";
import { inr } from "@/lib/format";
import type { PurposeDetails, PurposePendingFlat } from "@/lib/payment-purposes-api";

const BADGE_COLORS = [
  "bg-sky-500",
  "bg-rose-700",
  "bg-lime-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-emerald-700",
];

function badgeColor(flatNumber: string) {
  let h = 0;
  for (let i = 0; i < flatNumber.length; i++) {
    h = (h + flatNumber.charCodeAt(i) * (i + 1)) % BADGE_COLORS.length;
  }
  return BADGE_COLORS[h];
}

function FlatBadge({ flatNumber, title }: { flatNumber: string; title: string }) {
  return (
    <span
      title={title}
      className={
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[11px] font-bold tabular-nums text-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] " +
        badgeColor(flatNumber)
      }
    >
      {flatNumber}
    </span>
  );
}

interface Props {
  open: boolean;
  details: PurposeDetails | null;
  loading?: boolean;
  onClose: () => void;
}

export default function PurposeSummaryModal({ open, details, loading = false, onClose }: Props) {
  const soldPending = useMemo(() => {
    if (!details) return [] as PurposePendingFlat[];
    return details.pending
      .filter((row) => {
        if ((Number(row.pendingAmount) || 0) <= 0) return false;
        return String(row.flatStatus || "") !== "available";
      })
      .slice()
      .sort(
        (a, b) =>
          a.floorNumber - b.floorNumber ||
          Number(a.flatNumber) - Number(b.flatNumber) ||
          a.flatNumber.localeCompare(b.flatNumber)
      );
  }, [details]);

  const unsoldPending = useMemo(() => {
    if (!details) return [] as PurposePendingFlat[];
    const fromPending = details.pending.filter(
      (row) => (Number(row.pendingAmount) || 0) > 0 && String(row.flatStatus || "") === "available"
    );
    const byNumber = new Map(fromPending.map((r) => [r.flatNumber, r]));
    for (const row of details.unsoldPending || []) {
      if ((Number(row.pendingAmount) || 0) <= 0) continue;
      if (byNumber.has(row.flatNumber)) continue;
      byNumber.set(row.flatNumber, {
        flatId: row.flatId,
        flatNumber: row.flatNumber,
        floorNumber: row.floorNumber,
        ownerName: "",
        ownerMobile: "",
        hasOwner: false,
        pendingAmount: row.pendingAmount,
        flatStatus: "available",
      });
    }
    return Array.from(byNumber.values()).sort(
      (a, b) =>
        a.floorNumber - b.floorNumber ||
        Number(a.flatNumber) - Number(b.flatNumber) ||
        a.flatNumber.localeCompare(b.flatNumber)
    );
  }, [details]);

  if (!open) return null;

  const title = details?.purpose.title || "Purpose Summary";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purpose-summary-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="purpose-summary-title" className="truncate text-lg font-bold text-navy">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Collection summary</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm font-medium text-slate-400 hover:text-navy"
          >
            Close
          </button>
        </div>

        {loading && !details ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading summary…</p>
        ) : details ? (
          <div className="space-y-4">
            {/* Count cards — match screenshot layout */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[10px] text-slate-500">કુલ ફ્લેટ</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-navy">
                    {details.summary.totalFlats}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <div className="text-[10px] font-medium text-emerald-700">જમા થયેલ</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                    {details.summary.paidFlats}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <div className="text-[10px] font-medium text-rose-700">બાકી</div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-rose-800">
                    {details.summary.pendingFlats}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[10px] text-slate-500">કુલ જમા રકમ</div>
                  <div className="mt-0.5 text-base font-bold tabular-nums text-brand">
                    {inr(details.summary.totalCollected)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[10px] text-slate-500">કુલ બાકી રકમ</div>
                  <div className="mt-0.5 text-base font-bold tabular-nums text-amber-700">
                    {inr(details.summary.totalPending)}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-[10px] text-slate-500">Collection %</div>
                <div className="mt-0.5 text-base font-bold tabular-nums text-navy">
                  {details.summary.collectionPercent ?? 0}%
                </div>
              </div>
            </div>

            {/* Sold pending flat numbers */}
            {soldPending.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Sold pending ({soldPending.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {soldPending.map((flat) => (
                    <FlatBadge
                      key={`sold-${flat.flatId || flat.flatNumber}`}
                      flatNumber={flat.flatNumber}
                      title={`Sold Flat ${flat.flatNumber} pending`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unsold pending flat numbers */}
            {unsoldPending.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                  Unsold pending ({unsoldPending.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unsoldPending.map((flat) => (
                    <FlatBadge
                      key={`unsold-${flat.flatId || flat.flatNumber}`}
                      flatNumber={flat.flatNumber}
                      title={`Unsold Flat ${flat.flatNumber} pending`}
                    />
                  ))}
                </div>
              </div>
            )}

            {soldPending.length === 0 && unsoldPending.length === 0 && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                બધું ક્લિયર ✓ — કોઈ બાકી નથી.
              </p>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">Summary unavailable.</p>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
