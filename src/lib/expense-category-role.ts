/** Role of an expense category for KIRAN 3 Common balance (independent of monthly split). */
export const EXPENSE_CATEGORY_ROLES = ["normal", "common_credit", "common_debit"] as const;
export type ExpenseCategoryRole = (typeof EXPENSE_CATEGORY_ROLES)[number];

export const EXPENSE_CATEGORY_ROLE_OPTIONS: {
  value: ExpenseCategoryRole;
  label: string;
}[] = [
  { value: "normal", label: "Normal" },
  { value: "common_credit", label: "Common Credit (+)" },
  { value: "common_debit", label: "Common Debit (-)" },
];

export function parseExpenseCategoryRole(
  value: unknown,
  fallback: ExpenseCategoryRole = "normal"
): ExpenseCategoryRole {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (raw === "common_credit" || raw === "commoncredit" || raw === "credit") {
    return "common_credit";
  }
  if (raw === "common_debit" || raw === "commondebit" || raw === "debit") {
    return "common_debit";
  }
  if (raw === "normal") return "normal";
  return fallback;
}

export function expenseCategoryRoleLabel(role: ExpenseCategoryRole): string {
  const hit = EXPENSE_CATEGORY_ROLE_OPTIONS.find((o) => o.value === role);
  return hit?.label ?? "Normal";
}
