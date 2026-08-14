"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { inr } from "@/lib/format";
import { formField, formSelect } from "@/lib/form-styles";
import type { PaymentMode } from "@/lib/payments-api";
import {
  readCommonExpenseSplit,
  type CommonExpenseSplitStats,
  emptyCommonExpenseSplit,
} from "@/lib/common-expense-split-api";
import type { BuilderCommonCollectionRecord } from "@/lib/builder-common-collections-api";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const MODES: PaymentMode[] = ["cash", "bank", "upi", "cheque"];

export type BuilderCommonCollectionFormData = {
  month: number;
  year: number;
  expenseCategory: string;
  amount: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  referenceNumber: string;
  notes: string;
};

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: BuilderCommonCollectionRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: BuilderCommonCollectionFormData) => Promise<void>;
  /** Switch back to Member collection form */
  onSwitchToMember?: () => void;
}

export default function BuilderCommonCollectionModal({
  open,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
  onSwitchToMember,
}: Props) {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expenseCategory, setExpenseCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [split, setSplit] = useState<CommonExpenseSplitStats>(() =>
    emptyCommonExpenseSplit(now.getMonth() + 1, now.getFullYear())
  );
  const [splitLoading, setSplitLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setMonth(initial.month);
      setYear(initial.year);
      setExpenseCategory(initial.expenseCategory);
      setAmount(initial.amount);
      setPaymentDate(initial.paymentDate || new Date().toISOString().slice(0, 10));
      setPaymentMode(initial.paymentMode);
      setReferenceNumber(initial.referenceNumber || "");
      setNotes(initial.notes || "");
    } else {
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      setMonth(m);
      setYear(y);
      setExpenseCategory("");
      setAmount(0);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMode("cash");
      setReferenceNumber("");
      setNotes("");
    }
  }, [open, mode, initial, now]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSplitLoading(true);
    readCommonExpenseSplit(month, year, { force: true })
      .then((data) => {
        if (!cancelled) setSplit(data);
      })
      .catch(() => {
        if (!cancelled) setSplit(emptyCommonExpenseSplit(month, year));
      })
      .finally(() => {
        if (!cancelled) setSplitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, year]);

  const categoryOptions = useMemo(() => {
    const fromSplit = split.categories.map((c) => c.category);
    const included = split.includedCategories;
    const set = new Set([...fromSplit, ...included].filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [split]);

  useEffect(() => {
    if (!open || expenseCategory) return;
    if (categoryOptions.length === 1) setExpenseCategory(categoryOptions[0]);
  }, [open, expenseCategory, categoryOptions]);

  const selectedCategoryShare = useMemo(() => {
    if (!expenseCategory) return null;
    return (
      split.categories.find(
        (c) => c.category.toLowerCase() === expenseCategory.toLowerCase()
      ) || null
    );
  }, [split.categories, expenseCategory]);

  const categoryPending = selectedCategoryShare
    ? mode === "edit" && initial && initial.expenseCategory === expenseCategory
      ? selectedCategoryShare.pending + (Number(initial.amount) || 0)
      : selectedCategoryShare.pending
    : 0;

  const years = useMemo(() => {
    const set = new Set(split.years.length ? split.years : [year]);
    set.add(year);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [split.years, year, now]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!expenseCategory.trim()) {
      setLocalError("Expense Category is required");
      return;
    }
    if (!amount || amount <= 0) {
      setLocalError("Amount must be greater than 0");
      return;
    }
    if (categoryPending > 0 && Math.round(amount) > Math.round(categoryPending)) {
      setLocalError(
        `Amount exceeds Builder Pending for this category (pending ${inr(Math.round(categoryPending))})`
      );
      return;
    }
    await onSubmit({
      month,
      year,
      expenseCategory: expenseCategory.trim(),
      amount,
      paymentDate,
      paymentMode,
      referenceNumber: referenceNumber.trim(),
      notes: notes.trim(),
    });
  }

  const displayError = localError || error;
  const field = formField;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Collection" : "Edit Builder Collection"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Builder payment against Monthly Common Expense Share
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm font-medium text-slate-400 hover:text-navy disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-600">Payer Type</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSwitchToMember?.()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Member
              </button>
              <button
                type="button"
                className="rounded-xl border border-brand bg-brand/5 px-3 py-2.5 text-left text-sm font-semibold text-brand"
              >
                Builder
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Month
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={formSelect}
                disabled={saving}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Year
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={formSelect}
                disabled={saving}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Expense Category <span className="text-rose-500">*</span>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className={formSelect}
              required
              disabled={saving || splitLoading}
            >
              <option value="">
                {splitLoading ? "Loading categories…" : "Select category…"}
              </option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl bg-orange-50 px-3.5 py-3 text-[11px] leading-relaxed text-orange-800">
            <div className="font-semibold">
              Builder Share (month): {splitLoading ? "…" : inr(Math.round(split.builderShare))}
            </div>
            <div className="mt-1">
              Collected: {splitLoading ? "…" : inr(Math.round(split.builderCollected))} · Pending:{" "}
              {splitLoading ? "…" : inr(Math.round(split.builderPending))}
            </div>
            {selectedCategoryShare ? (
              <div className="mt-1.5 border-t border-orange-200/80 pt-1.5">
                <span className="font-semibold">{selectedCategoryShare.category}</span>
                {" — "}
                Share {inr(Math.round(selectedCategoryShare.builderShare))} · Pending{" "}
                {inr(Math.round(categoryPending))}
              </div>
            ) : null}
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Amount <span className="text-rose-500">*</span>
            <span className="ml-1 font-normal text-slate-400">({inr(amount || 0)})</span>
            <input
              type="number"
              min={0}
              step="1"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={field}
              required
              disabled={saving}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Payment Date
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={field}
                required
                disabled={saving}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Payment Mode
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className={formSelect}
                disabled={saving}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Reference / Transaction No.{" "}
            <span className="font-normal text-slate-400">(Optional)</span>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="UTR / Cheque no."
              className={field}
              disabled={saving}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Notes <span className="font-normal text-slate-400">(Optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={field + " resize-none"}
              disabled={saving}
            />
          </label>
        </div>

        {displayError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {displayError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !expenseCategory || amount <= 0}
            className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {saving
              ? mode === "add"
                ? "Saving…"
                : "Updating…"
              : mode === "add"
                ? "Add Collection"
                : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
