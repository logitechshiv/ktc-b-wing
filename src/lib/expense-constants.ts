export const EXPENSE_PAYMENT_METHODS = ["cash", "bank", "upi", "cheque"] as const;
export type DbExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];
