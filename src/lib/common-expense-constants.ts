/** Fixed denominator for Monthly Common Expense Split (B-Wing). */
export const COMMON_EXPENSE_TOTAL_FLATS = 52;

/**
 * Only these expense categories count toward Monthly Common Expense Split.
 * Matching is by DB `category` field (not expense title).
 */
export const COMMON_EXPENSE_INCLUDED_CATEGORIES = [
  "Security",
  "Housekeeping",
  "Electricity",
  "Water",
  "Lift Maintenance",
  "Repair & Maintenance",
  "Gardening",
  "Pest Control",
  "Admin/Stationery",
  "KIRAN 3 Society Expense",
] as const;

/** Categories that must never enter the common split. */
export const COMMON_EXPENSE_EXCLUDED_CATEGORIES = [
  "Flat Expense",
  "Event",
  "Festival",
] as const;

function normalizeCategory(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const INCLUDED_SET = new Set(
  COMMON_EXPENSE_INCLUDED_CATEGORIES.map((c) => normalizeCategory(c))
);
const EXCLUDED_SET = new Set(
  COMMON_EXPENSE_EXCLUDED_CATEGORIES.map((c) => normalizeCategory(c))
);

/** True when category is allowlisted and not excluded. */
export function isCommonExpenseCategory(category: string): boolean {
  const key = normalizeCategory(category);
  if (!key) return false;
  if (EXCLUDED_SET.has(key)) return false;
  return INCLUDED_SET.has(key);
}

export function computePerFlatShare(totalCommonExpense: number, totalFlats = COMMON_EXPENSE_TOTAL_FLATS) {
  const total = Number.isFinite(totalCommonExpense) ? Math.max(0, totalCommonExpense) : 0;
  const flats = totalFlats > 0 ? totalFlats : COMMON_EXPENSE_TOTAL_FLATS;
  if (total === 0) return 0;
  const share = total / flats;
  return Number.isFinite(share) ? share : 0;
}
