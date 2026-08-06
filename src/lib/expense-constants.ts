export const EXPENSE_METHODS = ["fund", "collection"] as const;
export type DbExpenseMethod = (typeof EXPENSE_METHODS)[number];

export const EXPENSE_PAYMENT_METHODS = ["cash", "bank", "upi", "cheque"] as const;
export type DbExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "Lift",
  "Security",
  "Housekeeping",
  "Flat Expense",
  "Event",
] as const;
