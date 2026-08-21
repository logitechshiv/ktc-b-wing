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