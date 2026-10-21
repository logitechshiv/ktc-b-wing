import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  allocateWholeRupeeShares,
  computePerFlatShare,
  normalizeCategoryName,
  roundRupeePaise,
  soldFlatsFromUnsold,
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

import { parseExpenseSplitScope, type DbExpenseSplitScope } from "@/lib/expense-constants";

export interface CommonExpenseCategoryShare {
  category: string;
  expenseTotal: number;
  builderShare: number;
  collected: number;
  pending: number;
}

export interface CommonExpenseItemLine {
  id?: string;
  category: string;
  expenseType?: string;
  splitScope?: "all" | "sold";
  title: string;
  titleGujarati: string;
  amount: number;
  date?: string;
  notes?: string;
  hasBill?: boolean;
  billUrl?: string;
}

export interface CommonExpenseSplitResult {
  month: number;
  year: number;
  totalCommonExpense: number;
  totalSoldUnsoldExpense: number;
  totalOnlySoldExpense: number;
  totalFlats: number;
  perFlatShare: number;
  perFlatShareAll: number;
  perSoldFlatShare: number;
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
      {
        category: 1,
        expenseType: 1,
        splitScope: 1,
        amount: 1,
        expenseTitle: 1,
        expenseTitleGujarati: 1,
        expenseDate: 1,
        notes: 1,
        billImage: 1,
        billImages: 1,
      }
    )
      .sort({ expenseDate: -1, createdAt: -1 })
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
    getMonthlyUnsoldFlats(m, y),
    sumBuilderCollectedByCategory(m, y),
  ]);

  const categoryTotals = new Map<
    string,
    { label: string; total: number; totalAll: number; totalSold: number }
  >();
  const expenseItems: CommonExpenseItemLine[] = [];
  let totalCommonExpense = 0;
  let totalSoldUnsoldExpense = 0;
  let totalOnlySoldExpense = 0;
  let expenseCount = 0;

  for (const doc of monthDocs) {
    const d = doc as {
      _id?: { toString(): string };
      category?: string;
      expenseType?: string;
      splitScope?: string;
      expenseTitle?: string;
      expenseTitleGujarati?: string;
      amount?: number;
      expenseDate?: Date;
      notes?: string;
      billImage?: string;
      billImages?: string[];
    };
    const category = String(d.category || "");
    if (!categoryNameMatchesIncluded(category, includedCategories)) continue;
    const amount = Number(d.amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const splitScope = parseExpenseSplitScope(d.splitScope);

    totalCommonExpense += amount;
    if (splitScope === "sold") {
      totalOnlySoldExpense += amount;
    } else {
      totalSoldUnsoldExpense += amount;
    }
    expenseCount += 1;

    const key = normalizeCategoryName(category);
    const label =
      includedCategories.find((c) => normalizeCategoryName(c) === key) ||
      category.trim();
    const prev = categoryTotals.get(key);
    if (prev) {
      prev.total += amount;
      if (splitScope === "sold") {
        prev.totalSold += amount;
      } else {
        prev.totalAll += amount;
      }
    } else {
      categoryTotals.set(key, {
        label,
        total: amount,
        totalAll: splitScope === "sold" ? 0 : amount,
        totalSold: splitScope === "sold" ? amount : 0,
      });
    }

    const billUrl = d.billImages?.[0] || d.billImage || "";
    expenseItems.push({
      id: d._id ? d._id.toString() : "",
      category: label,
      expenseType: d.expenseType || "general",
      splitScope,
      title: String(d.expenseTitle || "").trim(),
      titleGujarati: String(d.expenseTitleGujarati || "").trim(),
      amount,
      date: d.expenseDate ? new Date(d.expenseDate).toISOString() : "",
      notes: String(d.notes || "").trim(),
      hasBill: Boolean(billUrl || (d.billImages && d.billImages.length > 0)),
      billUrl,
    });
  }
  expenseItems.sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  if (!Number.isFinite(totalCommonExpense) || totalCommonExpense < 0) {
    totalCommonExpense = 0;
  }
  if (!Number.isFinite(totalSoldUnsoldExpense) || totalSoldUnsoldExpense < 0) {
    totalSoldUnsoldExpense = 0;
  }
  if (!Number.isFinite(totalOnlySoldExpense) || totalOnlySoldExpense < 0) {
    totalOnlySoldExpense = 0;
  }

  const years = yearRows
    .map((r) => Number(r._id))
    .filter((n) => Number.isFinite(n) && n > 1970);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  if (!years.includes(y)) years.push(y);
  years.sort((a, b) => b - a);

  const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
  const unsold = monthlyUnsoldFlats === null ? 0 : Number(monthlyUnsoldFlats) || 0;
  const sold = soldFlatsFromUnsold(unsold, totalFlats);

  // Sold/Unsold expenses are split across all 52 flats
  const perFlatRawAll = computePerFlatShare(totalSoldUnsoldExpense, totalFlats);
  const perFlatShareAll = roundRupeePaise(perFlatRawAll);

  // Builder pays their share of Sold/Unsold expenses only
  const builderShare = roundRupeePaise(perFlatShareAll * unsold);

  // Members pay their share of Sold/Unsold expenses PLUS 100% of Only Sold expenses
  const memberAllShare = roundRupeePaise(perFlatShareAll * sold);
  const memberShare = roundRupeePaise(memberAllShare + totalOnlySoldExpense);

  // Per sold flat calculation
  const perSoldFlatExtra = sold > 0 ? computePerFlatShare(totalOnlySoldExpense, sold) : 0;
  const perSoldFlatShare = roundRupeePaise(perFlatShareAll + perSoldFlatExtra);

  // Display / multiply per-flat (for Sold/Unsold share)
  const perFlatShare = perFlatShareAll;

  const categoryRows = Array.from(categoryTotals.entries()).map(([key, row]) => {
    const catPerFlatAll = roundRupeePaise(computePerFlatShare(row.totalAll, totalFlats));
    return {
      key,
      label: row.label,
      expenseTotal: row.total,
      exactBuilderShare: roundRupeePaise(catPerFlatAll * unsold),
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
    totalSoldUnsoldExpense,
    totalOnlySoldExpense,
    totalFlats,
    perFlatShare,
    perFlatShareAll,
    perSoldFlatShare,
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
