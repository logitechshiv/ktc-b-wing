import ExpenseCategory from "@/models/ExpenseCategory";
import Expense from "@/models/Expense";
import {
  defaultIncludeInCommonExpense,
  normalizeCategoryName,
} from "@/lib/common-expense-constants";
import { parseExpenseCategoryRole } from "@/lib/expense-category-role";

/**
 * Normalized category names whose Role is Common Credit (+) or Common Debit (−).
 * These belong only to the Kiran 3 Common card — never Fund Summary expense totals.
 */
export async function getKiran3OnlyCategoryKeys(): Promise<Set<string>> {
  await syncExpenseCategoriesFromExpenses();
  await ensureExpenseCategoryRoles();
  const docs = await ExpenseCategory.find({})
    .select({ name: 1, role: 1 })
    .lean()
    .exec();
  const keys = new Set<string>();
  for (const doc of docs) {
    const role = parseExpenseCategoryRole(
      (doc as { role?: string | null }).role,
      "normal"
    );
    if (role !== "common_credit" && role !== "common_debit") continue;
    const key = normalizeCategoryName(String(doc.name || ""));
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Safely backfill `includeInCommonExpense` on existing categories.
 * Does not overwrite categories that already have the field set.
 */
export async function ensureExpenseCategoryCommonFlags(): Promise<void> {
  const missing = await ExpenseCategory.find({
    includeInCommonExpense: { $exists: false },
  })
    .select({ _id: 1, name: 1 })
    .lean()
    .exec();

  if (missing.length === 0) return;

  await Promise.all(
    missing.map((doc) =>
      ExpenseCategory.updateOne(
        { _id: doc._id, includeInCommonExpense: { $exists: false } },
        {
          $set: {
            includeInCommonExpense: defaultIncludeInCommonExpense(String(doc.name || "")),
          },
        }
      )
    )
  );
}

/** Backfill missing `role` as Normal — never overwrite an existing role. */
export async function ensureExpenseCategoryRoles(): Promise<void> {
  await ExpenseCategory.updateMany(
    {
      $or: [
        { role: { $exists: false } },
        { role: null },
        { role: "" },
      ],
    } as Record<string, unknown>,
    { $set: { role: "normal" } }
  );
}

/**
 * Insert any expense `category` strings that are missing from expense_categories.
 * Never overwrites existing include flags or roles.
 */
export async function syncExpenseCategoriesFromExpenses(): Promise<void> {
  await ensureExpenseCategoryCommonFlags();
  await ensureExpenseCategoryRoles();
  const [existing, names] = await Promise.all([
    ExpenseCategory.find({}).select({ name: 1 }).lean().exec(),
    Expense.distinct("category"),
  ]);
  const have = new Set(
    existing.map((d) => normalizeCategoryName(String(d.name || ""))).filter(Boolean)
  );
  const toInsert: {
    name: string;
    includeInCommonExpense: boolean;
    role: "normal";
  }[] = [];
  for (const raw of names) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = normalizeCategoryName(name);
    if (!key || have.has(key)) continue;
    have.add(key);
    toInsert.push({
      name,
      includeInCommonExpense: defaultIncludeInCommonExpense(name),
      role: "normal",
    });
  }
  if (toInsert.length === 0) return;
  await ExpenseCategory.insertMany(toInsert, { ordered: false }).catch(() => {
    /* ignore duplicate races */
  });
}

/** Build a case-insensitive set of category names marked for common split. */
export async function getIncludedCommonExpenseCategoryNames(): Promise<string[]> {
  await syncExpenseCategoriesFromExpenses();
  const docs = await ExpenseCategory.find({ includeInCommonExpense: true })
    .select({ name: 1 })
    .lean()
    .exec();
  return docs
    .map((d) => String(d.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function getExcludedCommonExpenseCategoryNames(): Promise<string[]> {
  await syncExpenseCategoriesFromExpenses();
  const docs = await ExpenseCategory.find({
    $or: [{ includeInCommonExpense: false }, { includeInCommonExpense: { $exists: false } }],
  })
    .select({ name: 1 })
    .lean()
    .exec();
  return docs
    .map((d) => String(d.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function categoryNameMatchesIncluded(
  expenseCategory: string,
  includedNames: string[]
): boolean {
  const key = normalizeCategoryName(expenseCategory);
  if (!key) return false;
  return includedNames.some((name) => normalizeCategoryName(name) === key);
}
