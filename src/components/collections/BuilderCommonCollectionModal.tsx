"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { inr } from "@/lib/format";
import { formField, formSelect } from "@/lib/form-styles";
import type { PaymentMode } from "@/lib/payments-api";
import { BUILDER_MONTHLY_COLLECTION_LABEL } from "@/lib/common-expense-constants";
import { displayExpenseTitle } from "@/lib/expense-utils";
import {
  readCommonExpenseSplit,
  type CommonExpenseSplitStats,
  emptyCommonExpenseSplit,
  builderAutofillAmount,
} from "@/lib/common-expense-split-api";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import type { BuilderCommonCollectionRecord } from "@/lib/builder-common-collections-api";

function autoNotesFromSplit(data: CommonExpenseSplitStats) {
  return (data.expenseItems || [])
    .map((item) => {
      const title = displayExpenseTitle(item.titleGujarati, item.title);
      return `${item.category} : ${title}`;
    })
    .filter(Boolean)
    .join("\n");
}

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

  // Reset fields when modal opens — Amount autofills immediately from cache when possible
  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setMonth(initial.month);
      setYear(initial.year);
      setAmount(Math.round(Number(initial.amount) || 0));
      setPaymentDate(initial.paymentDate || new Date().toISOString().slice(0, 10));
      setPaymentMode(initial.paymentMode);
      setReferenceNumber(initial.referenceNumber || "");
      setNotes(initial.notes || "");
      return;
    }

    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    setMonth(m);
    setYear(y);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMode("cash");
    setReferenceNumber("");

    const cached = peekCache<CommonExpenseSplitStats>(CacheKeys.commonExpenseSplit(m, y));
    if (cached) {
      setSplit(cached);
      setAmount(builderAutofillAmount(cached));
      setNotes(autoNotesFromSplit(cached));
    } else {
      setAmount(0);
      setNotes("");
    }
  }, [open, mode, initial, now]);

  // Load / refresh split for selected month-year and keep Amount in sync
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSplitLoading(true);

    // Prefer cached value first so Builder tab click shows Amount immediately
    const cached = peekCache<CommonExpenseSplitStats>(CacheKeys.commonExpenseSplit(month, year));
    if (cached && !cancelled) {
      setSplit(cached);
      if (mode === "edit" && initial && initial.month === month && initial.year === year) {
        setAmount(Math.round(Number(initial.amount) || 0));
      } else {
        setAmount(builderAutofillAmount(cached));
        setNotes(autoNotesFromSplit(cached));
      }
    }

    readCommonExpenseSplit(month, year, { force: true })
      .then((data) => {
        if (cancelled) return;
        setSplit(data);
        if (mode === "edit" && initial && initial.month === month && initial.year === year) {
          setAmount(Math.round(Number(initial.amount) || 0));
          setNotes(initial.notes || "");
        } else {
          setAmount(builderAutofillAmount(data));
          setNotes(autoNotesFromSplit(data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSplit(emptyCommonExpenseSplit(month, year));
          if (mode === "add" && !cached) {
            setAmount(0);
            setNotes("");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setSplitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, year, mode, initial]);

  const monthPending =
    mode === "edit" && initial && initial.month === month && initial.year === year
      ? Math.round(split.builderPending) + Math.round(Number(initial.amount) || 0)
      : Math.round(split.builderPending);

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
    if (!amount || amount <= 0) {
      setLocalError("Amount must be greater than 0");
      return;
    }
    if (monthPending > 0 && Math.round(amount) > monthPending) {
      setLocalError(
        `Amount exceeds Builder Pending for this month (pending ${inr(monthPending)})`
      );
      return;
    }
    if (monthPending <= 0 && mode === "add") {
      setLocalError("No Builder Pending for this month");
      return;
    }
    await onSubmit({
      month,
      year,
      expenseCategory: BUILDER_MONTHLY_COLLECTION_LABEL,
      amount: Math.round(amount),
      paymentDate,
      paymentMode,
      referenceNumber: referenceNumber.trim(),
      notes: notes.trim(),
    });
  }

  const displayError = localError || error;
  const field = formField;
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";

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
              Builder payment for monthly Common Expense Share
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

          <div className="rounded-xl bg-orange-50 px-3.5 py-3 text-[11px] leading-relaxed text-orange-800">
            <div className="font-semibold">
              {monthLabel} {year} — Builder Share:{" "}
              {splitLoading ? "…" : inr(Math.round(split.builderShare))}
            </div>
            <div className="mt-1">
              Collected: {splitLoading ? "…" : inr(Math.round(split.builderCollected))} · Pending:{" "}
              {splitLoading ? "…" : inr(monthPending)}
            </div>
            <p className="mt-1.5 text-orange-700/80">
              Amount auto-fills with remaining Builder Pending for this month.
            </p>
          </div>

          {/* {!splitLoading && split.expenseItems.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
              <div className="text-xs font-semibold text-slate-600">
                Included common expenses ({monthLabel} {year})
              </div>
              <ul className="mt-2 space-y-2">
                {split.expenseItems.map((item, idx) => {
                  const title = displayExpenseTitle(item.titleGujarati, item.title);
                  return (
                    <li key={`${item.category}-${idx}`} className="text-[11px] leading-snug text-slate-700">
                      <span className="font-semibold text-navy">{item.category}</span>
                      <span className="text-slate-400"> : </span>
                      <span>{title}</span>
                      <span className="ml-1 tabular-nums text-slate-500">
                        ({inr(Math.round(item.amount))})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null} */}

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
              disabled={saving || (splitLoading && amount <= 0)}
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
            disabled={saving || splitLoading || amount <= 0 || (mode === "add" && monthPending <= 0)}
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
