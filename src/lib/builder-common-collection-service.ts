import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import Flat from "@/models/Flat";
import BuilderCommonCollection from "@/models/BuilderCommonCollection";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  allocateWholeRupeeShares,
  computePerFlatShare,
  normalizeCategoryName,
} from "@/lib/common-expense-constants";
import {
  categoryNameMatchesIncluded,
  getIncludedCommonExpenseCategoryNames,
} from "@/lib/expense-category-common";

export type BuilderCollectionStatus = "pending" | "partially_paid" | "fully_paid";

export interface BuilderCommonCollectionRecord {
  id: string;
  month: number;
  year: number;
  expenseCategory: string;
  amount: number;
  paymentMode: DbPaymentMode;
  paymentDate: string;
  referenceNumber: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuilderCommonCollectionInput {
  month: number;
  year: number;
  expenseCategory: string;
  amount: number;
  paymentMode: DbPaymentMode;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
}

function serialize(doc: {
  _id: { toString(): string };
  month: number;
  year: number;
  expenseCategory?: string | null;
  amount: number;
  paymentMode: string;
  paymentDate: Date;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): BuilderCommonCollectionRecord {
  return {
    id: doc._id.toString(),
    month: Number(doc.month),
    year: Number(doc.year),
    expenseCategory: String(doc.expenseCategory || "").trim(),
    amount: Number(doc.amount) || 0,
    paymentMode: doc.paymentMode as DbPaymentMode,
    paymentDate: doc.paymentDate
      ? new Date(doc.paymentDate).toISOString().slice(0, 10)
      : "",
    referenceNumber: String(doc.referenceNumber || "").trim(),
    notes: String(doc.notes || "").trim(),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}

export function computeBuilderStatus(
  share: number,
  collected: number
): BuilderCollectionStatus {
  const s = Math.max(0, Number(share) || 0);
  const c = Math.max(0, Number(collected) || 0);
  if (s <= 0) {
    return c > 0 ? "fully_paid" : "pending";
  }
  if (c <= 0) return "pending";
  if (c + 0.005 >= s) return "fully_paid";
  return "partially_paid";
}

export async function listBuilderCommonCollections(params: {
  month?: number;
  year?: number;
  category?: string;
  limit?: number;
}): Promise<BuilderCommonCollectionRecord[]> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (params.month && params.month >= 1 && params.month <= 12) {
    filter.month = Math.floor(params.month);
  }
  if (params.year && params.year >= 1970) {
    filter.year = Math.floor(params.year);
  }
  if (params.category?.trim()) {
    filter.expenseCategory = params.category.trim();
  }
  const limit =
    params.limit && params.limit > 0 ? Math.min(500, Math.floor(params.limit)) : 200;

  const docs = await BuilderCommonCollection.find(filter)
    .sort({ paymentDate: -1, createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((d) => serialize(d as never));
}

export async function sumBuilderCollected(params: {
  month: number;
  year: number;
  category?: string;
  excludeId?: string;
}): Promise<number> {
  await connectDB();
  const match: Record<string, unknown> = {
    month: params.month,
    year: params.year,
  };
  if (params.category?.trim()) {
    match.expenseCategory = params.category.trim();
  }
  if (params.excludeId) {
    match._id = { $ne: params.excludeId };
  }

  const rows = await BuilderCommonCollection.aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).exec();

  return Math.max(0, Number(rows[0]?.total) || 0);
}

export async function sumBuilderCollectedByCategory(
  month: number,
  year: number
): Promise<Map<string, number>> {
  await connectDB();
  const rows = await BuilderCommonCollection.aggregate<{
    _id: string;
    total: number;
  }>([
    { $match: { month, year } },
    {
      $group: {
        _id: "$expenseCategory",
        total: { $sum: "$amount" },
      },
    },
  ]).exec();

  const map = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeCategoryName(String(row._id || ""));
    if (!key) continue;
    map.set(key, Math.max(0, Number(row.total) || 0));
  }
  return map;
}

/** Category builder share for month — reconciled whole rupees (same as Common Expense Split). */
export async function getCategoryBuilderShare(
  month: number,
  year: number,
  expenseCategory: string
): Promise<{ category: string; expenseTotal: number; builderShare: number } | null> {
  await connectDB();
  const included = await getIncludedCommonExpenseCategoryNames();
  const wantKey = normalizeCategoryName(expenseCategory);
  const label = included.find((c) => normalizeCategoryName(c) === wantKey);
  if (!label) return null;

  const [monthDocs, unsoldFlats] = await Promise.all([
    Expense.find(
      {
        $expr: {
          $and: [
            { $eq: [{ $year: "$expenseDate" }, year] },
            { $eq: [{ $month: "$expenseDate" }, month] },
          ],
        },
      },
      { category: 1, amount: 1 }
    )
      .lean()
      .exec(),
    Flat.countDocuments({ status: "available" }),
  ]);

  const categoryTotals = new Map<string, { label: string; total: number }>();
  let totalCommonExpense = 0;

  for (const doc of monthDocs) {
    const category = String((doc as { category?: string }).category || "");
    if (!categoryNameMatchesIncluded(category, included)) continue;
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalCommonExpense += amount;
    const key = normalizeCategoryName(category);
    const prev = categoryTotals.get(key);
    if (prev) {
      prev.total += amount;
    } else {
      const catLabel =
        included.find((c) => normalizeCategoryName(c) === key) || category.trim();
      categoryTotals.set(key, { label: catLabel, total: amount });
    }
  }

  const unsold = Number(unsoldFlats) || 0;
  const perFlatShare = computePerFlatShare(totalCommonExpense, COMMON_EXPENSE_TOTAL_FLATS);
  const builderShareTotal = Math.round(perFlatShare * unsold);

  const rows = Array.from(categoryTotals.entries()).map(([key, row]) => {
    const catPerFlat = computePerFlatShare(row.total, COMMON_EXPENSE_TOTAL_FLATS);
    return {
      key,
      label: row.label,
      expenseTotal: row.total,
      exactBuilderShare: catPerFlat * unsold,
    };
  });
  rows.sort((a, b) => b.expenseTotal - a.expenseTotal);

  const allocated = allocateWholeRupeeShares(
    rows.map((r) => r.exactBuilderShare),
    builderShareTotal
  );

  const idx = rows.findIndex((r) => r.key === wantKey);
  if (idx < 0) {
    return { category: label, expenseTotal: 0, builderShare: 0 };
  }

  return {
    category: rows[idx].label,
    expenseTotal: rows[idx].expenseTotal,
    builderShare: allocated[idx] ?? 0,
  };
}

function validateInput(body: Record<string, unknown>): {
  ok: true;
  data: BuilderCommonCollectionInput;
} | { ok: false; message: string } {
  const month = Number(body.month);
  const year = Number(body.year);
  const expenseCategory = String(body.expenseCategory ?? body.category ?? "").trim();
  const amount = Number(body.amount);
  const paymentMode = String(body.paymentMode ?? body.paymentMethod ?? "")
    .trim()
    .toLowerCase() as DbPaymentMode;
  const paymentDateRaw = body.paymentDate
    ? String(body.paymentDate)
    : new Date().toISOString().slice(0, 10);
  const paymentDate = paymentDateRaw.slice(0, 10);
  const referenceNumber = String(body.referenceNumber ?? body.reference ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { ok: false, message: "Valid month is required (1–12)" };
  }
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    return { ok: false, message: "Valid year is required" };
  }
  if (!expenseCategory) {
    return { ok: false, message: "Expense Category is required" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return { ok: false, message: "Valid payment mode is required" };
  }
  if (!paymentDate || Number.isNaN(Date.parse(paymentDate))) {
    return { ok: false, message: "Valid payment date is required" };
  }

  return {
    ok: true,
    data: {
      month: Math.floor(month),
      year: Math.floor(year),
      expenseCategory,
      amount,
      paymentMode,
      paymentDate,
      referenceNumber,
      notes,
    },
  };
}

async function resolveCanonicalCategory(name: string): Promise<string | null> {
  const included = await getIncludedCommonExpenseCategoryNames();
  const key = normalizeCategoryName(name);
  const hit = included.find((c) => normalizeCategoryName(c) === key);
  return hit || null;
}

async function assertWithinCategoryPending(params: {
  month: number;
  year: number;
  expenseCategory: string;
  amount: number;
  excludeId?: string;
}): Promise<{ ok: true; pending: number; share: number } | { ok: false; message: string }> {
  const shareRow = await getCategoryBuilderShare(
    params.month,
    params.year,
    params.expenseCategory
  );
  if (!shareRow || shareRow.builderShare <= 0) {
    return {
      ok: false,
      message: `No builder share for category "${params.expenseCategory}" in this month`,
    };
  }

  const already = await sumBuilderCollected({
    month: params.month,
    year: params.year,
    category: shareRow.category,
    excludeId: params.excludeId,
  });
  const pending = Math.max(0, shareRow.builderShare - already);
  // Compare in whole rupees — share is often fractional (total/52) while UI shows rounded amounts
  if (Math.round(params.amount) > Math.round(pending)) {
    return {
      ok: false,
      message: `Amount exceeds Builder Pending for ${shareRow.category} (pending ₹${Math.round(pending).toLocaleString("en-IN")}, share ₹${Math.round(shareRow.builderShare).toLocaleString("en-IN")})`,
    };
  }
  return { ok: true, pending, share: shareRow.builderShare };
}

export async function createBuilderCommonCollection(
  body: Record<string, unknown>,
  createdBy?: string | null
): Promise<BuilderCommonCollectionRecord> {
  const validated = validateInput(body);
  if (!validated.ok) throw new Error(validated.message);

  const canonical = await resolveCanonicalCategory(validated.data.expenseCategory);
  if (!canonical) {
    throw new Error(
      "Expense Category must be marked Include in Common Expense"
    );
  }

  const data = { ...validated.data, expenseCategory: canonical };
  const check = await assertWithinCategoryPending({
    month: data.month,
    year: data.year,
    expenseCategory: data.expenseCategory,
    amount: data.amount,
  });
  if (!check.ok) throw new Error(check.message);

  await connectDB();
  const doc = await BuilderCommonCollection.create({
    month: data.month,
    year: data.year,
    expenseCategory: data.expenseCategory,
    amount: data.amount,
    paymentMode: data.paymentMode,
    paymentDate: new Date(data.paymentDate),
    referenceNumber: data.referenceNumber || "",
    notes: data.notes || "",
    createdBy: createdBy || null,
  });

  return serialize(doc as never);
}

export async function updateBuilderCommonCollection(
  id: string,
  body: Record<string, unknown>
): Promise<BuilderCommonCollectionRecord> {
  const validated = validateInput(body);
  if (!validated.ok) throw new Error(validated.message);

  const canonical = await resolveCanonicalCategory(validated.data.expenseCategory);
  if (!canonical) {
    throw new Error(
      "Expense Category must be marked Include in Common Expense"
    );
  }

  const data = { ...validated.data, expenseCategory: canonical };
  const check = await assertWithinCategoryPending({
    month: data.month,
    year: data.year,
    expenseCategory: data.expenseCategory,
    amount: data.amount,
    excludeId: id,
  });
  if (!check.ok) throw new Error(check.message);

  await connectDB();
  const doc = await BuilderCommonCollection.findByIdAndUpdate(
    id,
    {
      month: data.month,
      year: data.year,
      expenseCategory: data.expenseCategory,
      amount: data.amount,
      paymentMode: data.paymentMode,
      paymentDate: new Date(data.paymentDate),
      referenceNumber: data.referenceNumber || "",
      notes: data.notes || "",
    },
    { new: true }
  ).exec();

  if (!doc) throw new Error("Builder collection not found");
  return serialize(doc as never);
}

export async function deleteBuilderCommonCollection(id: string): Promise<void> {
  await connectDB();
  const res = await BuilderCommonCollection.findByIdAndDelete(id).exec();
  if (!res) throw new Error("Builder collection not found");
}
