/** Fixed denominator for Monthly Common Expense Split (B-Wing). */
export const COMMON_EXPENSE_TOTAL_FLATS = 52;

/**
 * Expense category that represents money the wing has given to Kiran 3 Common
 * (Society Advance). Used by the Dashboard "Kiran 3 Common" card.
 */
export const KIRAN3_SOCIETY_ADVANCE_CATEGORY = "KIRAN 3 Society Advance";

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
  KIRAN3_SOCIETY_ADVANCE_CATEGORY,
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

/**
 * Convert fractional shares into whole rupees that sum exactly to `targetTotal`
 * (largest-remainder method). Avoids category rounded shares summing to ±1
 * vs the month Builder Share (e.g. 4381+21833=26214 when total is 26213).
 */
export function allocateWholeRupeeShares(
  exactAmounts: number[],
  targetTotal: number
): number[] {
  const n = exactAmounts.length;
  if (n === 0) return [];

  const target = Math.max(0, Math.round(Number(targetTotal) || 0));
  if (target === 0) return Array(n).fill(0);

  const values = exactAmounts.map((x) => Math.max(0, Number(x) || 0));
  const floors = values.map((v) => Math.floor(v + 1e-9));
  let sumFloor = floors.reduce((a, b) => a + b, 0);

  if (sumFloor > target) {
    const out = [...floors];
    let excess = sumFloor - target;
    const order = values
      .map((v, i) => ({ i, rem: v - floors[i] }))
      .sort((a, b) => a.rem - b.rem || b.i - a.i);
    for (const { i } of order) {
      if (excess <= 0) break;
      if (out[i] <= 0) continue;
      const take = Math.min(excess, out[i]);
      out[i] -= take;
      excess -= take;
    }
    return out;
  }

  let remaining = target - sumFloor;
  const order = values
    .map((v, i) => ({ i, rem: v - floors[i] }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < order.length && remaining > 0; k++) {
    out[order[k].i] += 1;
    remaining -= 1;
  }
  return out;
}

export function parseIncludeInCommonExpense(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}
