import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import Flat from "@/models/Flat";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  computePerFlatShare,
} from "@/lib/common-expense-constants";
import {
  categoryNameMatchesIncluded,
  getExcludedCommonExpenseCategoryNames,
  getIncludedCommonExpenseCategoryNames,
} from "@/lib/expense-category-common";

export interface CommonExpenseSplitResult {
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

export async function getCommonExpenseSplit(
  month: number,
  year: number
): Promise<CommonExpenseSplitResult> {
  await connectDB();

  const m = Math.min(12, Math.max(1, Math.floor(month) || 1));
  const y = Math.floor(year) || new Date().getUTCFullYear();

  const [
    includedCategories,
    excludedCategories,
    monthDocs,
    yearRows,
    soldFlats,
    unsoldFlats,
  ] = await Promise.all([
    getIncludedCommonExpenseCategoryNames(),
    getExcludedCommonExpenseCategoryNames(),
    Expense.find(
      {
        $expr: {
          $and: [
            { $eq: [{ $year: "$expenseDate" }, y] },
            { $eq: [{ $month: "$expenseDate" }, m] },
          ],
        },
      },
      { category: 1, amount: 1 }
    )
      .lean()
      .exec(),
    Expense.aggregate<{ _id: number }>([
      {
        $group: {
          _id: { $year: "$expenseDate" },
        },
      },
      { $sort: { _id: -1 } },
    ]).exec(),
    Flat.countDocuments({ status: "sold" }),
    Flat.countDocuments({ status: "available" }),
  ]);

  let totalCommonExpense = 0;
  let expenseCount = 0;
  for (const doc of monthDocs) {
    const category = String((doc as { category?: string }).category || "");
    if (!categoryNameMatchesIncluded(category, includedCategories)) continue;
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalCommonExpense += amount;
    expenseCount += 1;
  }

  if (!Number.isFinite(totalCommonExpense) || totalCommonExpense < 0) {
    totalCommonExpense = 0;
  }

  const years = yearRows
    .map((r) => Number(r._id))
    .filter((n) => Number.isFinite(n) && n > 1970);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  if (!years.includes(y)) years.push(y);
  years.sort((a, b) => b - a);

  const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
  const perFlatShare = computePerFlatShare(totalCommonExpense, totalFlats);

  return {
    month: m,
    year: y,
    totalCommonExpense,
    totalFlats,
    perFlatShare,
    expenseCount,
    soldFlats: Number(soldFlats) || 0,
    unsoldFlats: Number(unsoldFlats) || 0,
    years,
    includedCategories,
    excludedCategories,
  };
}
