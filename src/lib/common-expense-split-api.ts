import { COMMON_EXPENSE_TOTAL_FLATS } from "@/lib/common-expense-constants";

export { COMMON_EXPENSE_TOTAL_FLATS };

export interface CommonExpenseSplitStats {
  month: number;
  year: number;
  totalCommonExpense: number;
  totalFlats: number;
  perFlatShare: number;
  expenseCount: number;
  soldFlats: number;
  unsoldFlats: number;
  years: number[];
  includedCategories: string[];
  excludedCategories: string[];
}

export function emptyCommonExpenseSplit(
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear()
): CommonExpenseSplitStats {
  return {
    month,
    year,
    totalCommonExpense: 0,
    totalFlats: COMMON_EXPENSE_TOTAL_FLATS,
    perFlatShare: 0,
    expenseCount: 0,
    soldFlats: 0,
    unsoldFlats: 0,
    years: [year],
    includedCategories: [],
    excludedCategories: [],
  };
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function readCommonExpenseSplit(
  month: number,
  year: number
): Promise<CommonExpenseSplitStats> {
  const sp = new URLSearchParams({
    month: String(month),
    year: String(year),
  });
  const res = await fetch(`/api/dashboard/common-expense-split?${sp.toString()}`, {
    cache: "no-store",
  });
  const data = await parseJson(res);
  const totalCommonExpense = Math.max(0, Number(data.totalCommonExpense) || 0);
  const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
  const perFlatShare = Math.max(0, Number(data.perFlatShare) || 0);
  return {
    month: Number(data.month) || month,
    year: Number(data.year) || year,
    totalCommonExpense: Number.isFinite(totalCommonExpense) ? totalCommonExpense : 0,
    totalFlats,
    perFlatShare: Number.isFinite(perFlatShare) ? perFlatShare : 0,
    expenseCount: Math.max(0, Number(data.expenseCount) || 0),
    soldFlats: Math.max(0, Number(data.soldFlats) || 0),
    unsoldFlats: Math.max(0, Number(data.unsoldFlats) || 0),
    years: Array.isArray(data.years)
      ? (data.years as number[])
          .map((y) => Number(y))
          .filter((y) => Number.isFinite(y))
      : [year],
    includedCategories: Array.isArray(data.includedCategories)
      ? (data.includedCategories as unknown[]).map((c) => String(c || "").trim()).filter(Boolean)
      : [],
    excludedCategories: Array.isArray(data.excludedCategories)
      ? (data.excludedCategories as unknown[]).map((c) => String(c || "").trim()).filter(Boolean)
      : [],
  };
}
