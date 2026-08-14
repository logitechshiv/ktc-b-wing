import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import Flat from "@/models/Flat";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  allocateWholeRupeeShares,
  computePerFlatShare,
  normalizeCategoryName,
} from "@/lib/common-expense-constants";
import {
  categoryNameMatchesIncluded,
  getExcludedCommonExpenseCategoryNames,
  getIncludedCommonExpenseCategoryNames,
} from "@/lib/expense-category-common";
import {
  computeBuilderStatus,
  sumBuilderCollectedByCategory,
  type BuilderCollectionStatus,
} from "@/lib/builder-common-collection-service";

export interface CommonExpenseCategoryShare {
  category: string;
  expenseTotal: number;
  builderShare: number;
  collected: number;
  pending: number;
}

export interface CommonExpenseSplitResult {
  month: number;
  year: number;
  totalCommonExpense: number;
  totalFlats: number;
  perFlatShare: number;
  expenseCount: number;
  soldFlats: number;
  unsoldFlats: number;
  memberShare: number;
  builderShare: number;
  builderCollected: number;
  builderPending: number;
  builderStatus: BuilderCollectionStatus;
  categories: CommonExpenseCategoryShare[];
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
    collectedByCategory,
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
    sumBuilderCollectedByCategory(m, y),
  ]);

  const categoryTotals = new Map<string, { label: string; total: number }>();
  let totalCommonExpense = 0;
  let expenseCount = 0;

  for (const doc of monthDocs) {
    const category = String((doc as { category?: string }).category || "");
    if (!categoryNameMatchesIncluded(category, includedCategories)) continue;
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalCommonExpense += amount;
    expenseCount += 1;
    const key = normalizeCategoryName(category);
    const prev = categoryTotals.get(key);
    if (prev) {
      prev.total += amount;
    } else {
      const label =
        includedCategories.find((c) => normalizeCategoryName(c) === key) ||
        category.trim();
      categoryTotals.set(key, { label, total: amount });
    }
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
  const sold = Number(soldFlats) || 0;
  const unsold = Number(unsoldFlats) || 0;
  const memberShareExact = perFlatShare * sold;
  const builderShareExact = perFlatShare * unsold;
  const builderShare = Math.round(builderShareExact);
  const memberShare = Math.round(memberShareExact);

  const categoryRows = Array.from(categoryTotals.entries()).map(([key, row]) => {
    const catPerFlat = computePerFlatShare(row.total, totalFlats);
    return {
      key,
      label: row.label,
      expenseTotal: row.total,
      exactBuilderShare: catPerFlat * unsold,
      collected: collectedByCategory.get(key) || 0,
    };
  });
  categoryRows.sort((a, b) => b.expenseTotal - a.expenseTotal);

  const allocatedShares = allocateWholeRupeeShares(
    categoryRows.map((r) => r.exactBuilderShare),
    builderShare
  );

  const categories: CommonExpenseCategoryShare[] = categoryRows.map((row, i) => {
    const catBuilderShare = allocatedShares[i] ?? 0;
    const collected = row.collected;
    return {
      category: row.label,
      expenseTotal: row.expenseTotal,
      builderShare: catBuilderShare,
      collected,
      pending: Math.max(0, catBuilderShare - collected),
    };
  });

  // Include included categories with 0 expense but existing collections
  for (const [key, collected] of collectedByCategory) {
    if (categories.some((c) => normalizeCategoryName(c.category) === key)) continue;
    const label =
      includedCategories.find((c) => normalizeCategoryName(c) === key) || key;
    categories.push({
      category: label,
      expenseTotal: 0,
      builderShare: 0,
      collected,
      pending: 0,
    });
  }

  const builderCollected = categories.reduce((s, c) => s + c.collected, 0);
  const builderPending = Math.max(0, builderShare - builderCollected);

  return {
    month: m,
    year: y,
    totalCommonExpense,
    totalFlats,
    perFlatShare,
    expenseCount,
    soldFlats: sold,
    unsoldFlats: unsold,
    memberShare,
    builderShare,
    builderCollected,
    builderPending,
    builderStatus: computeBuilderStatus(builderShare, builderCollected),
    categories,
    years,
    includedCategories,
    excludedCategories,
  };
}
