import ExpenseCategory from "@/models/ExpenseCategory";
import {
  defaultIncludeInCommonExpense,
  normalizeCategoryName,
} from "@/lib/common-expense-constants";

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

/** Build a case-insensitive set of category names marked for common split. */
export async function getIncludedCommonExpenseCategoryNames(): Promise<string[]> {
  await ensureExpenseCategoryCommonFlags();
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
  await ensureExpenseCategoryCommonFlags();
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
