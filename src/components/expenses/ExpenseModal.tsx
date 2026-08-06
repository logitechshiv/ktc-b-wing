"use client";

import { useEffect, useState, type FormEvent } from "react";
import { inr } from "@/lib/format";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  uploadExpenseBill,
  type ExpenseInput,
  type ExpenseMethod,
  type ExpensePaymentMethod,
  type ExpenseRecord,
} from "@/lib/expenses-api";
import type { PurposeRecord } from "@/lib/payment-purposes-api";
import { formField, formSelect } from "@/lib/form-styles";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: ExpenseRecord | null;
  purposes: PurposeRecord[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ExpenseInput) => Promise<void>;
}

export default function ExpenseModal({
  open,
  mode,
  initial,
  purposes,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [category, setCategory] = useState("Security");
  const [customCategory, setCustomCategory] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseTitleGujarati, setExpenseTitleGujarati] = useState("");
  const [amount, setAmount] = useState(0);
  const [expenseMethod, setExpenseMethod] = useState<ExpenseMethod>("fund");
  const [collectionPurposeId, setCollectionPurposeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("cash");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billImage, setBillImage] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const activePurposes = purposes.filter((p) => p.isActive);
  const isCustomCategory = category === "__custom__";

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      const known = (DEFAULT_EXPENSE_CATEGORIES as readonly string[]).includes(initial.category);
      setCategory(known ? initial.category : "__custom__");
      setCustomCategory(known ? "" : initial.category);
      setExpenseTitle(initial.expenseTitle);
      setExpenseTitleGujarati(initial.expenseTitleGujarati);
      setAmount(initial.amount);
      setExpenseMethod(initial.expenseMethod);
      setCollectionPurposeId(initial.collectionPurposeId || "");
      setPaymentMethod(initial.paymentMethod);
      setExpenseDate(initial.expenseDate || new Date().toISOString().slice(0, 10));
      setBillImage(initial.billImage);
      setNotes(initial.notes);
    } else {
      setCategory("Security");
      setCustomCategory("");
      setExpenseTitle("");
      setExpenseTitleGujarati("");
      setAmount(0);
      setExpenseMethod("fund");
      setCollectionPurposeId("");
      setPaymentMethod("cash");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setBillImage("");
      setNotes("");
    }
  }, [open, mode, initial]);

  if (!open) return null;

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setLocalError(null);
    try {
      const url = await uploadExpenseBill(file);
      setBillImage(url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setLocalError("Category is required");
      return;
    }
    if (!expenseTitle.trim() && !expenseTitleGujarati.trim()) {
      setLocalError("Expense Title is required");
      return;
    }
    if (!amount || amount <= 0) {
      setLocalError("Amount must be greater than 0");
      return;
    }
    if (expenseMethod === "collection" && !collectionPurposeId) {
      setLocalError("Purpose is required for collection expenses");
      return;
    }

    const purpose = activePurposes.find((p) => p.id === collectionPurposeId);

    await onSubmit({
      category: finalCategory,
      expenseTitle: expenseTitle.trim(),
      expenseTitleGujarati: expenseTitleGujarati.trim(),
      amount,
      expenseMethod,
      collectionPurposeId: expenseMethod === "collection" ? collectionPurposeId : null,
      collectionPurposeName: expenseMethod === "collection" ? purpose?.title || "" : "",
      paymentMethod,
      expenseDate,
      billImage,
      notes: notes.trim(),
    });
  }

  const field = formField;
  const fieldSelect = formSelect;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Expense" : "Edit Expense"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Category, amount, method & bill</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldSelect} required>
              {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">Custom Category…</option>
            </select>
          </label>

          {isCustomCategory && (
            <label className="block text-xs font-semibold text-slate-600">
              Custom Category Name
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className={field}
                required
              />
            </label>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Expense Title (English)
            <input value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} className={field} />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Expense Title (Gujarati)
            <input
              value={expenseTitleGujarati}
              onChange={(e) => setExpenseTitleGujarati(e.target.value)}
              className={field}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Expense Amount ({inr(amount || 0)})
            <input
              type="number"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={field}
              required
            />
          </label>

          <div>
            <div className="text-xs font-semibold text-slate-600">Expense Method</div>
            <div className="mt-1 space-y-2">
              {(
                [
                  ["fund", "Fund માંથી ખર્ચ કરવામાં આવ્યો"],
                  ["collection", "ઉઘરાણીમાંથી ખર્ચ કરવામાં આવ્યો"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExpenseMethod(value)}
                  className={
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition " +
                    (expenseMethod === value
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 items-center justify-center rounded-full border " +
                      (expenseMethod === value ? "border-brand" : "border-slate-300")
                    }
                  >
                    {expenseMethod === value && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {expenseMethod === "collection" && (
            <label className="block text-xs font-semibold text-slate-600">
              Purpose
              <select
                value={collectionPurposeId}
                onChange={(e) => setCollectionPurposeId(e.target.value)}
                className={fieldSelect}
                required
              >
                <option value="">Select purpose…</option>
                {activePurposes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({inr(p.amount)})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Expense Date
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={field}
              required
            />
          </label>

          <div>
            <div className="text-xs font-semibold text-slate-600">Payment Method</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {(["cash", "bank", "upi", "cheque"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize " +
                    (paymentMethod === m
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Bill Upload (JPG, PNG, PDF)
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(e) => void handleFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand"
            />
            {uploading && <p className="mt-1 text-[11px] text-slate-400">Uploading…</p>}
            {billImage && (
              <a
                href={billImage}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex text-[11px] font-semibold text-brand hover:underline"
              >
                View uploaded bill
              </a>
            )}
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={field + " resize-none"}
            />
          </label>
        </div>

        {(localError || error) && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {localError || error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="h-11 flex-1 rounded-xl bg-black text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-70"
          >
            {saving ? "Saving…" : mode === "add" ? "Add Expense" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
