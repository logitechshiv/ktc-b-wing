"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { inr } from "@/lib/format";
import { MAX_EXPENSE_BILL_DOCUMENTS } from "@/lib/expense-utils";
import {
  uploadExpenseBill,
  type ExpenseCategoryRecord,
  type ExpenseInput,
  type ExpensePaymentMethod,
  type ExpenseRecord,
} from "@/lib/expenses-api";
import { formField, formSelect } from "@/lib/form-styles";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: ExpenseRecord | null;
  categories: ExpenseCategoryRecord[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ExpenseInput) => Promise<void>;
}

function docLabel(url: string, index: number) {
  const lower = url.toLowerCase();
  const kind = lower.includes(".pdf") || lower.includes("application/pdf") ? "PDF" : "Image";
  return `Document ${index + 1} (${kind})`;
}

export default function ExpenseModal({
  open,
  mode,
  initial,
  categories,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [category, setCategory] = useState("");
  const [expenseTitleGujarati, setExpenseTitleGujarati] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("cash");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billImages, setBillImages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (mode === "edit" && initial) {
      setCategory(initial.category);
      setExpenseTitleGujarati(initial.expenseTitleGujarati);
      setAmount(initial.amount);
      setPaymentMethod(initial.paymentMethod);
      setExpenseDate(initial.expenseDate || new Date().toISOString().slice(0, 10));
      setBillImages(
        initial.billImages?.length
          ? initial.billImages
          : initial.billImage
            ? [initial.billImage]
            : []
      );
      setNotes(initial.notes);
    } else {
      setCategory(categories[0]?.name || "");
      setExpenseTitleGujarati("");
      setAmount(0);
      setPaymentMethod("cash");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setBillImages([]);
      setNotes("");
    }
    // Only re-init when opening / switching record — not when categories list refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, mode, initial?.id]);

  if (!open) return null;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const remaining = MAX_EXPENSE_BILL_DOCUMENTS - billImages.length;
    if (remaining <= 0) {
      setLocalError(`You can attach up to ${MAX_EXPENSE_BILL_DOCUMENTS} documents`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setUploading(true);
    setLocalError(null);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const url = await uploadExpenseBill(file);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) {
        setBillImages((prev) => {
          const next = [...prev];
          for (const url of uploaded) {
            if (!next.includes(url) && next.length < MAX_EXPENSE_BILL_DOCUMENTS) {
              next.push(url);
            }
          }
          return next;
        });
      }
      if (fileList.length > remaining) {
        setLocalError(
          `Only ${remaining} more document${remaining === 1 ? "" : "s"} could be added (max ${MAX_EXPENSE_BILL_DOCUMENTS}).`
        );
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeDocument(url: string) {
    setBillImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!category.trim()) {
      setLocalError("Category is required");
      return;
    }
    if (!expenseTitleGujarati.trim()) {
      setLocalError("Expense Title (Gujarati) is required");
      return;
    }
    if (!amount || amount <= 0) {
      setLocalError("Amount must be greater than 0");
      return;
    }

    await onSubmit({
      category: category.trim(),
      expenseTitleGujarati: expenseTitleGujarati.trim(),
      amount,
      paymentMethod,
      expenseDate,
      billImage: billImages[0] || "",
      billImages,
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
            <p className="mt-0.5 text-xs text-slate-500">Category, amount, payment & bills</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldSelect}
              required
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {mode === "edit" &&
                initial?.category &&
                !categories.some((c) => c.name === initial.category) && (
                  <option value={initial.category}>{initial.category}</option>
                )}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Expense Title (Gujarati)
            <input
              value={expenseTitleGujarati}
              onChange={(e) => setExpenseTitleGujarati(e.target.value)}
              className={field}
              required
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

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Bill Upload (JPG, JPEG, PNG, PDF) — multiple
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => void handleFiles(e.target.files)}
                disabled={uploading || billImages.length >= MAX_EXPENSE_BILL_DOCUMENTS}
                className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand disabled:opacity-60"
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              {billImages.length}/{MAX_EXPENSE_BILL_DOCUMENTS} documents attached
            </p>
            {uploading && <p className="mt-1 text-[11px] text-slate-400">Uploading…</p>}
            {billImages.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {billImages.map((url, index) => (
                  <li
                    key={url}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-[11px] font-semibold text-brand hover:underline"
                    >
                      {docLabel(url, index)}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeDocument(url)}
                      disabled={uploading}
                      className="shrink-0 text-[11px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
