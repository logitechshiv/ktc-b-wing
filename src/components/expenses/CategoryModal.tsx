"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  EXPENSE_CATEGORY_ROLE_OPTIONS,
  parseExpenseCategoryRole,
  type ExpenseCategoryRole,
} from "@/lib/expense-category-role";
import { formField, formSelect } from "@/lib/form-styles";
import type { ExpenseCategoryRecord } from "@/lib/expenses-api";

export type CategoryModalInput = {
  name: string;
  includeInCommonExpense: boolean;
  role: ExpenseCategoryRole;
};

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: ExpenseCategoryRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CategoryModalInput) => Promise<void>;
}

export default function CategoryModal({
  open,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ExpenseCategoryRole>("normal");
  const [includeInCommonExpense, setIncludeInCommonExpense] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setName(initial.name);
      setRole(parseExpenseCategoryRole(initial.role, "normal"));
      setIncludeInCommonExpense(!!initial.includeInCommonExpense);
    } else {
      setName("");
      setRole("normal");
      setIncludeInCommonExpense(false);
    }
  }, [open, mode, initial?.id]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Category name is required");
      return;
    }
    setLocalError(null);
    await onSubmit({
      name: trimmed,
      includeInCommonExpense,
      role,
    });
  }

  const field = formField;
  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "add" ? "Add Category" : "Edit Category"}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Category" : "Edit Category"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Expense category for KIRAN 3 Common</p>
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
          <label className="block text-xs font-semibold text-slate-600">
            Category Name <span className="text-rose-500">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Security"
              className={field}
              required
              autoFocus
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Role
            <select
              value={role}
              onChange={(e) => setRole(parseExpenseCategoryRole(e.target.value, "normal"))}
              className={formSelect}
              disabled={saving}
            >
              {EXPENSE_CATEGORY_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={includeInCommonExpense}
              onChange={(e) => setIncludeInCommonExpense(e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand disabled:opacity-50"
            />
            Include in Common Expense
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
            disabled={saving || !name.trim()}
            className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {saving
              ? mode === "add"
                ? "Adding…"
                : "Saving…"
              : mode === "add"
                ? "Add Category"
                : "Save Category"}
          </button>
        </div>
      </form>
    </div>
  );
}
