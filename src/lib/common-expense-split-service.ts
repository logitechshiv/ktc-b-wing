import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import Flat from "@/models/Flat";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  allocateWholeRupeeShares,
  computePerFlatShare,
  normalizeCategoryName,
  roundRupeePaise,
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
import { getMonthlyUnsoldFlats } from "@/lib/builder-monthly-unsold-flats-service";

export interface CommonExpenseCategoryShare {
  category: string;
  expenseTotal: number;
  builderShare: number;
  collected: number;
  pending: number;
}

export interface CommonExpenseItemLine {
  category: string;
  title: string;
  titleGujarati: string;
  amount: number;
}

export interface CommonExpenseSplitResult {
  month: number;
  year: number;
  totalCommonExpense: number;
  totalFlats: number;
  perFlatShare: number;
  expenseCount: number;
  soldFlats: number;
  unsoldFlats: number | null;
  hasMonthlyUnsoldFlats: boolean;
  memberShare: number;
  builderShare: number;
  builderCollected: number;
  builderPending: number;
  builderStatus: BuilderCollectionStatus;
  categories: CommonExpenseCategoryShare[];
  expenseItems: CommonExpenseItemLine[];
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
    monthlyUnsoldFlats,
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
      { category: 1, amount: 1, expenseTitle: 1, expenseTitleGujarati: 1, expenseDate: 1 }
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
    getMonthlyUnsoldFlats(m, y),
    sumBuilderCollectedByCategory(m, y),
  ]);

  const categoryTotals = new Map<string, { label: string; total: number }>();
  const expenseItems: CommonExpenseItemLine[] = [];
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
    const label =
      includedCategories.find((c) => normalizeCategoryName(c) === key) ||
      category.trim();
    const prev = categoryTotals.get(key);
    if (prev) {
      prev.total += amount;
    } else {
      categoryTotals.set(key, { label, total: amount });
    }
    expenseItems.push({
      category: label,
      title: String((doc as { expenseTitle?: string }).expenseTitle || "").trim(),
      titleGujarati: String(
        (doc as { expenseTitleGujarati?: string }).expenseTitleGujarati || ""
      ).trim(),
      amount,
    });
  }
  expenseItems.sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

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
  const perFlatRaw = computePerFlatShare(totalCommonExpense, totalFlats);
  // Display / multiply using 2-decimal per-flat (e.g. 1310.67 × 32 = 41941.44)
  const perFlatShare = roundRupeePaise(perFlatRaw);
  const sold = Number(soldFlats) || 0;
  const unsold = monthlyUnsoldFlats === null ? 0 : Number(monthlyUnsoldFlats) || 0;
  const memberShare = roundRupeePaise(perFlatShare * sold);
  const builderShare = roundRupeePaise(perFlatShare * unsold);

  const categoryRows = Array.from(categoryTotals.entries()).map(([key, row]) => {
    const catPerFlat = roundRupeePaise(computePerFlatShare(row.total, totalFlats));
    return {
      key,
      label: row.label,
      expenseTotal: row.total,
      exactBuilderShare: roundRupeePaise(catPerFlat * unsold),
      collected: collectedByCategory.get(key) || 0,
    };
  });
  categoryRows.sort((a, b) => b.expenseTotal - a.expenseTotal);

  // Allocate category shares in paise so they sum exactly to Builder Share
  const allocatedPaise = allocateWholeRupeeShares(
    categoryRows.map((r) => r.exactBuilderShare * 100),
    Math.round(builderShare * 100)
  );
  const allocatedShares = allocatedPaise.map((v) => v / 100);

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

  const builderCollected = roundRupeePaise(
    categories.reduce((s, c) => s + c.collected, 0)
  );
  const builderPending = Math.max(0, roundRupeePaise(builderShare - builderCollected));

  return {
    month: m,
    year: y,
    totalCommonExpense,
    totalFlats,
    perFlatShare,
    expenseCount,
    soldFlats: sold,
    unsoldFlats: monthlyUnsoldFlats === null ? null : unsold,
    hasMonthlyUnsoldFlats: monthlyUnsoldFlats !== null,
    memberShare,
    builderShare,
    builderCollected,
    builderPending,
    builderStatus: computeBuilderStatus(builderShare, builderCollected),
    categories,
    expenseItems,
    years,
    includedCategories,
    excludedCategories,
  };
}
