/** Fixed denominator for Monthly Common Expense Split (B-Wing). */
export const COMMON_EXPENSE_TOTAL_FLATS = 52;

/**
 * Legacy seed defaults used only when migrating categories that are missing
 * `includeInCommonExpense`. New/updated values come from MongoDB.
 */
export const LEGACY_COMMON_EXPENSE_INCLUDED_CATEGORIES = [
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

export const LEGACY_COMMON_EXPENSE_EXCLUDED_CATEGORIES = [
  "Flat Expense",
  "Event",
  "Festival",
] as const;

export function normalizeCategoryName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const LEGACY_INCLUDED_SET = new Set(
  LEGACY_COMMON_EXPENSE_INCLUDED_CATEGORIES.map((c) => normalizeCategoryName(c))
);
const LEGACY_EXCLUDED_SET = new Set(
  LEGACY_COMMON_EXPENSE_EXCLUDED_CATEGORIES.map((c) => normalizeCategoryName(c))
);

/** Default flag for a category name during safe migration / first seed. */
export function defaultIncludeInCommonExpense(name: string): boolean {
  const key = normalizeCategoryName(name);
  if (!key) return false;
  if (LEGACY_EXCLUDED_SET.has(key)) return false;
  return LEGACY_INCLUDED_SET.has(key);
}

export function computePerFlatShare(totalCommonExpense: number, totalFlats = COMMON_EXPENSE_TOTAL_FLATS) {
  const total = Number.isFinite(totalCommonExpense) ? Math.max(0, totalCommonExpense) : 0;
  const flats = totalFlats > 0 ? totalFlats : COMMON_EXPENSE_TOTAL_FLATS;
  if (total === 0) return 0;
  const share = total / flats;
  return Number.isFinite(share) ? share : 0;
}

export function parseIncludeInCommonExpense(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}
