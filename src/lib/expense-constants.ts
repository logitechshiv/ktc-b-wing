export const EXPENSE_PAYMENT_METHODS = ["cash", "bank", "upi", "cheque"] as const;
export type DbExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

/** Per-expense type: General stays in Fund Summary only; Common feeds Kiran 3 Debit. */
export const EXPENSE_TYPES = ["general", "common"] as const;
export type DbExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TYPE_OPTIONS: { value: DbExpenseType; label: string }[] = [
  { value: "general", label: "General Expense" },
  { value: "common", label: "Common Expense" },
];

export function parseExpenseType(value: unknown): DbExpenseType | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (raw === "general" || raw === "general_expense") return "general";
  if (raw === "common" || raw === "common_expense") return "common";
  return null;
}

/** Split scope for expenses: All (Sold & Unsold / 52 flats) or Sold only (Members only) */
export const EXPENSE_SPLIT_SCOPES = ["all", "sold"] as const;
export type DbExpenseSplitScope = (typeof EXPENSE_SPLIT_SCOPES)[number];

export const EXPENSE_SPLIT_SCOPE_OPTIONS: {
  value: DbExpenseSplitScope;
  label: string;
  hint: string;
}[] = [
  {
    value: "all",
    label: "Sold / Unsold Flat",
    hint: "All 52 flats (Members + Builder)",
  },
  {
    value: "sold",
    label: "Only Sold Flat",
    hint: "Sold flats only (No Builder share)",
  },
];

export function parseExpenseSplitScope(value: unknown): DbExpenseSplitScope {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (raw === "sold" || raw === "only_sold" || raw === "only_sold_flat") {
    return "sold";
  }
  return "all";
}

export function expenseSplitScopeLabel(scope?: unknown): string {
  return parseExpenseSplitScope(scope) === "sold"
    ? "Only Sold Flat"
    : "Sold / Unsold Flat";
}
