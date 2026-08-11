"use client";

import type { PurposePaidFlat } from "@/lib/payment-purposes-api";
import type { PaymentMode } from "@/lib/payments-api";

interface Props {
  open: boolean;
  payment: PurposePaidFlat | null;
  purposeTitle: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  notes: string;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onAmountChange: (amount: number) => void;
  onModeChange: (mode: PaymentMode) => void;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
}

export default function EditCollectionModal({
  open,
  payment,
  purposeTitle,
  amount,
  paymentMode,
  paymentDate,
  notes,
  saving,
  error,
  onClose,
  onAmountChange,
  onModeChange,
  onDateChange,
  onNotesChange,
  onSave,
}: Props) {
  if (!open || !payment) return null;

  const payerLabel =
    payment.paymentSource === "builder"
      ? `Builder${payment.ownerName ? ` · ${payment.ownerName}` : ""}`
      : payment.ownerName || "—";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-collection-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="edit-collection-title" className="text-lg font-bold text-navy">
              Edit Collection
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              Flat {payment.flatNumber} · {purposeTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Payer
            </div>
            <div className="mt-0.5 font-semibold text-navy">{payerLabel}</div>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Amount
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-600">Payment Method</div>
            <div className="flex flex-wrap gap-2">
              {(["cash", "bank", "upi", "cheque"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={
                    "min-w-[4.5rem] flex-1 rounded-xl border px-3 py-2 text-sm capitalize " +
                    (paymentMode === m
                      ? "border-brand bg-brand/5 font-medium text-brand"
                      : "border-slate-200 text-slate-600")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Payment Date
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Notes (optional)"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || amount <= 0 || !paymentDate}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
