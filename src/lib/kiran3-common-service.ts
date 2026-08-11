import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import ExpenseCategory from "@/models/ExpenseCategory";
import { normalizeCategoryName } from "@/lib/common-expense-constants";
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
  /** Σ amounts in Common Debit (-) categories */
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
 * Dashboard "Kiran 3 Common" from category Role (not names, not includeInCommonExpense):
 * Balance = Σ(common_credit expense amounts) − Σ(common_debit expense amounts)
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
    .select({ category: 1, amount: 1 })
    .lean()
    .exec();

  let totalCommonCredit = 0;
  let totalCommonDebit = 0;

  for (const doc of docs) {
    const category = String((doc as { category?: string }).category || "");
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const role = roleByName.get(normalizeCategoryName(category)) || "normal";
    if (role === "common_credit") totalCommonCredit += amount;
    else if (role === "common_debit") totalCommonDebit += amount;
  }

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
