import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import ExpenseCategory from "@/models/ExpenseCategory";
import { normalizeCategoryName } from "@/lib/common-expense-constants";
import { parseExpenseType } from "@/lib/expense-constants";
import {
  parseExpenseCategoryRole,
  type ExpenseCategoryRole,
} from "@/lib/expense-category-role";
import {
  ensureExpenseCategoryRoles,
  syncExpenseCategoriesFromExpenses,
} from "@/lib/expense-category-common";

export interface Kiran3CommonBalance {
  /** Σ amounts in Common Credit (+) categories */
  totalCommonCredit: number;
  /** Σ Common Expense amounts (+ legacy common_debit category role) */
  totalCommonDebit: number;
  /** credit − debit */
  balance: number;
  creditCategories: string[];
  debitCategories: string[];
  /** @deprecated alias of totalCommonCredit for older clients */
  givenToCommon: number;
  /** @deprecated alias of totalCommonDebit for older clients */
  commonExpense: number;
}

/**
 * Dashboard "Kiran 3 Common":
 * - Credit: expenses in categories with Role = Common Credit (+)
 *   (skipped when Expense Type is explicitly Common Expense — those are debit)
 * - Debit: Expense Type = Common Expense
 *   (+ legacy rows with no expenseType and category Role = Common Debit (−))
 * - General Expense never increases Common Debit
 * Balance = Total Common Credit − Total Common Debit
 */
export async function getKiran3CommonBalance(): Promise<Kiran3CommonBalance> {
  await connectDB();
  await syncExpenseCategoriesFromExpenses();
  await ensureExpenseCategoryRoles();

  const categoryDocs = await ExpenseCategory.find({})
    .select({ name: 1, role: 1 })
    .lean()
    .exec();

  const roleByName = new Map<string, ExpenseCategoryRole>();
  const creditCategories: string[] = [];
  const debitCategories: string[] = [];

  for (const doc of categoryDocs) {
    const name = String(doc.name || "").trim();
    if (!name) continue;
    const role = parseExpenseCategoryRole(
      (doc as { role?: string | null }).role,
      "normal"
    );
    roleByName.set(normalizeCategoryName(name), role);
    if (role === "common_credit") creditCategories.push(name);
    if (role === "common_debit") debitCategories.push(name);
  }

  creditCategories.sort((a, b) => a.localeCompare(b));
  debitCategories.sort((a, b) => a.localeCompare(b));

  const docs = await Expense.find({})
    .select({ category: 1, amount: 1, expenseType: 1 })
    .lean()
    .exec();

  let totalCommonCredit = 0;
  let totalCommonDebit = 0;
  const commonExpenseCategoryNames = new Set<string>();

  for (const doc of docs) {
    const category = String((doc as { category?: string }).category || "");
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const expenseType = parseExpenseType(
      (doc as { expenseType?: string | null }).expenseType
    );
    const role = roleByName.get(normalizeCategoryName(category)) || "normal";

    // Common Expense → Common Debit only
    if (expenseType === "common") {
      totalCommonDebit += amount;
      if (category.trim()) commonExpenseCategoryNames.add(category.trim());
      continue;
    }

    // General Expense → never Common Debit (and not treated as Common Expense)
    if (expenseType === "general") {
      // Credit income entries still use category Role = Common Credit (+)
      if (role === "common_credit") totalCommonCredit += amount;
      continue;
    }

    // Legacy rows (no expenseType): previous category-role behaviour
    if (role === "common_credit") totalCommonCredit += amount;
    else if (role === "common_debit") {
      totalCommonDebit += amount;
      if (category.trim()) commonExpenseCategoryNames.add(category.trim());
    }
  }

  for (const name of commonExpenseCategoryNames) {
    if (
      !debitCategories.some(
        (c) => normalizeCategoryName(c) === normalizeCategoryName(name)
      )
    ) {
      debitCategories.push(name);
    }
  }
  debitCategories.sort((a, b) => a.localeCompare(b));

  if (!Number.isFinite(totalCommonCredit) || totalCommonCredit < 0) totalCommonCredit = 0;
  if (!Number.isFinite(totalCommonDebit) || totalCommonDebit < 0) totalCommonDebit = 0;

  const balance = totalCommonCredit - totalCommonDebit;

  return {
    totalCommonCredit,
    totalCommonDebit,
    balance,
    creditCategories,
    debitCategories,
    givenToCommon: totalCommonCredit,
    commonExpense: totalCommonDebit,
  };
}
