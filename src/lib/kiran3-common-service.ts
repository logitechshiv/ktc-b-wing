import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import {
  KIRAN3_SOCIETY_ADVANCE_CATEGORY,
  normalizeCategoryName,
} from "@/lib/common-expense-constants";
import {
  categoryNameMatchesIncluded,
  getIncludedCommonExpenseCategoryNames,
  syncExpenseCategoriesFromExpenses,
} from "@/lib/expense-category-common";

export interface Kiran3CommonBalance {
  givenToCommon: number;
  commonExpense: number;
  balance: number;
  includedCategories: string[];
  societyAdvanceCategory: string;
}

/**
 * Dashboard "Kiran 3 Common" totals from expense records:
 * - Given to common = sum of KIRAN 3 Society Advance expenses
 * - Common expense = sum of expenses in categories marked includeInCommonExpense
 *   (Society Advance never counts as common expense)
 * - Balance = given − common expense
 */
export async function getKiran3CommonBalance(): Promise<Kiran3CommonBalance> {
  await connectDB();
  await syncExpenseCategoriesFromExpenses();

  const includedAll = await getIncludedCommonExpenseCategoryNames();
  const advanceKey = normalizeCategoryName(KIRAN3_SOCIETY_ADVANCE_CATEGORY);
  const includedCategories = includedAll.filter(
    (name) => normalizeCategoryName(name) !== advanceKey
  );

  const docs = await Expense.find({})
    .select({ category: 1, amount: 1 })
    .lean()
    .exec();

  let givenToCommon = 0;
  let commonExpense = 0;

  for (const doc of docs) {
    const category = String((doc as { category?: string }).category || "");
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (normalizeCategoryName(category) === advanceKey) {
      givenToCommon += amount;
      continue;
    }

    if (categoryNameMatchesIncluded(category, includedCategories)) {
      commonExpense += amount;
    }
  }

  if (!Number.isFinite(givenToCommon) || givenToCommon < 0) givenToCommon = 0;
  if (!Number.isFinite(commonExpense) || commonExpense < 0) commonExpense = 0;

  return {
    givenToCommon,
    commonExpense,
    balance: givenToCommon - commonExpense,
    includedCategories,
    societyAdvanceCategory: KIRAN3_SOCIETY_ADVANCE_CATEGORY,
  };
}
