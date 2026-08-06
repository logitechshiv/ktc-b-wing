"use client";

import { inr } from "@/lib/format";
import type { PurposePendingFlat, PurposeRecord } from "@/lib/payment-purposes-api";
import type { PaymentMode } from "@/lib/payments-api";
import { formSelect } from "@/lib/form-styles";

interface Props {
  open: boolean;
  purposes: PurposeRecord[];
  searchablePurposes: PurposeRecord[];
  formPurposeId: string;
  formPurposeLocked: boolean;
  formPurposeSearch: string;
  formPendingFlats: PurposePendingFlat[];
  formPendingLoading: boolean;
  formAllPaid: boolean;
  formFlatId: string;
  formAmount: number;
  formDate: string;
  formNotes: string;
  formMode: PaymentMode;
  formSaving: boolean;
  error?: string | null;
  displayOwnerName: (ownerName?: string | null) => string;
  onClose: () => void;
  onPurposeSearchChange: (value: string) => void;
  onPurposeChange: (purposeId: string) => void;
  onFlatChange: (flatId: string) => void;
  onAmountChange: (amount: number) => void;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onModeChange: (mode: PaymentMode) => void;
  onSave: () => void;
}

export default function CollectionModal({
  open,
  purposes,
  searchablePurposes,
  formPurposeId,
  formPurposeLocked,
  formPurposeSearch,
  formPendingFlats,
  formPendingLoading,
  formAllPaid,
  formFlatId,
  formAmount,
  formDate,
  formNotes,
  formMode,
  formSaving,
  error,
  displayOwnerName,
  onClose,
  onPurposeSearchChange,
  onPurposeChange,
  onFlatChange,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onModeChange,
  onSave,
}: Props) {
  if (!open) return null;

  const purposeOptions = formPurposeLocked
    ? purposes.filter((p) => p.id === formPurposeId)
    : searchablePurposes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !formSaving) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-navy">New collection</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={formSaving}
            className="text-sm font-medium text-slate-400 hover:text-navy"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Purpose
            {!formPurposeLocked && (
              <input
                value={formPurposeSearch}
                onChange={(e) => onPurposeSearchChange(e.target.value)}
                placeholder="Search purpose…"
                className="mt-1 mb-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            )}
            <select
              value={formPurposeId}
              onChange={(e) => onPurposeChange(e.target.value)}
              disabled={formPurposeLocked}
              className={
                formSelect +
                (formPurposeLocked
                  ? " cursor-default bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  : "")
              }
            >
              {!formPurposeLocked && <option value="">Select purpose…</option>}
              {purposeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({inr(p.amountPerFlat ?? p.amount)})
                </option>
              ))}
            </select>
            {formPurposeLocked && (
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                Purpose is locked to the currently selected purpose.
              </span>
            )}
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Flat / Owner (pending with owner)
            <select
              value={formFlatId}
              onChange={(e) => onFlatChange(e.target.value)}
              disabled={!formPurposeId || formAllPaid || formPendingLoading}
              className={
                formSelect +
                " disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:disabled:bg-slate-900"
              }
            >
              {!formPurposeId && <option value="">Select a purpose first…</option>}
              {formPurposeId && formPendingLoading && (
                <option value="">Loading pending flats…</option>
              )}
              {formPurposeId &&
                !formPendingLoading &&
                formPendingFlats.length === 0 &&
                !formAllPaid && <option value="">No pending flats</option>}
              {formPurposeId &&
                !formPendingLoading &&
                formPendingFlats.map((f) => (
                  <option key={f.flatId} value={f.flatId}>
                    {f.flatNumber} — {displayOwnerName(f.ownerName)}
                  </option>
                ))}
            </select>
          </label>

          {formPurposeId && formAllPaid && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No pending flats with owners for this purpose.
            </p>
          )}

          <input
            type="number"
            value={formAmount}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            disabled={!formPurposeId || formAllPaid}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
          />
          <input
            type="date"
            value={formDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={!formPurposeId || formAllPaid}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
          />
          <input
            type="text"
            value={formNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={!formPurposeId || formAllPaid}
            placeholder="Notes (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
          />
          <div className="flex gap-2">
            {(["cash", "bank", "upi"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!formPurposeId || formAllPaid}
                onClick={() => onModeChange(m)}
                className={
                  "flex-1 rounded-xl border px-3 py-2 text-sm capitalize disabled:opacity-50 " +
                  (formMode === m
                    ? "border-brand bg-brand/5 font-medium text-brand"
                    : "border-slate-200 text-slate-600")
                }
              >
                {m}
              </button>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={formSaving || !formPurposeId || formAllPaid || !formFlatId}
            className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white disabled:opacity-70"
          >
            {formSaving ? "Saving…" : "Save collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
