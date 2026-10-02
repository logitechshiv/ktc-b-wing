import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import BuilderCommonCollection from "@/models/BuilderCommonCollection";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";
import {
  BUILDER_MONTHLY_COLLECTION_LABEL,
  COMMON_EXPENSE_TOTAL_FLATS,
  allocateWholeRupeeShares,
  computePerFlatShare,
  normalizeCategoryName,
  roundRupeePaise,
} from "@/lib/common-expense-constants";
import {
  categoryNameMatchesIncluded,
  getIncludedCommonExpenseCategoryNames,
} from "@/lib/expense-category-common";
import {
  getMonthlyUnsoldFlats,
  parseMonthlyUnsoldFlats,
  setMonthlyUnsoldFlats,
} from "@/lib/builder-monthly-unsold-flats-service";

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
  unsoldFlats: number;
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
  if (params.excludeId && mongoose.Types.ObjectId.isValid(params.excludeId)) {
    // Aggregation $ne needs a real ObjectId; a string id would not exclude the
    // document being edited, so pending would look like ~₹0.03 leftover.
    match._id = { $ne: new mongoose.Types.ObjectId(params.excludeId) };
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

  const [monthDocs, monthlyUnsoldFlats] = await Promise.all([
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
    getMonthlyUnsoldFlats(month, year),
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

  const unsold = monthlyUnsoldFlats === null ? 0 : Number(monthlyUnsoldFlats) || 0;
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
  const unsoldFlats = parseMonthlyUnsoldFlats(body.unsoldFlats);
  // Category is no longer collected in UI — month/year pending only
  const expenseCategory =
    String(body.expenseCategory ?? body.category ?? "").trim() ||
    BUILDER_MONTHLY_COLLECTION_LABEL;

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { ok: false, message: "Valid month is required (1–12)" };
  }
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    return { ok: false, message: "Valid year is required" };
  }
  const amountRounded = roundRupeePaise(amount);
  if (!Number.isFinite(amountRounded) || amountRounded <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return { ok: false, message: "Valid payment mode is required" };
  }
  if (!paymentDate || Number.isNaN(Date.parse(paymentDate))) {
    return { ok: false, message: "Valid payment date is required" };
  }
  if (unsoldFlats === null) {
    return { ok: false, message: `Unsold Flats must be a whole number from 0 to ${COMMON_EXPENSE_TOTAL_FLATS}` };
  }

  return {
    ok: true,
    data: {
      month: Math.floor(month),
      year: Math.floor(year),
      expenseCategory,
      amount: amountRounded,
      paymentMode,
      paymentDate,
      referenceNumber,
      notes,
      unsoldFlats,
    },
  };
}

/** Month Builder Share (whole rupees) and remaining pending. */
export async function getMonthBuilderPending(params: {
  month: number;
  year: number;
  excludeId?: string;
  unsoldFlats?: number;
}): Promise<{ share: number; collected: number; pending: number; configured: boolean }> {
  await connectDB();
  const included = await getIncludedCommonExpenseCategoryNames();
  const [monthDocs, storedUnsoldFlats, collected] = await Promise.all([
    Expense.find(
      {
        $expr: {
          $and: [
            { $eq: [{ $year: "$expenseDate" }, params.year] },
            { $eq: [{ $month: "$expenseDate" }, params.month] },
          ],
        },
      },
      { category: 1, amount: 1 }
    )
      .lean()
      .exec(),
    getMonthlyUnsoldFlats(params.month, params.year),
    sumBuilderCollected({
      month: params.month,
      year: params.year,
      excludeId: params.excludeId,
    }),
  ]);

  let totalCommonExpense = 0;
  for (const doc of monthDocs) {
    const category = String((doc as { category?: string }).category || "");
    if (!categoryNameMatchesIncluded(category, included)) continue;
    const amount = Number((doc as { amount?: number }).amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalCommonExpense += amount;
  }

  const configuredUnsoldFlats = params.unsoldFlats ?? storedUnsoldFlats;
  const unsold = configuredUnsoldFlats === null ? 0 : Number(configuredUnsoldFlats) || 0;
  // Same rounding as Common Expense Split: paise-round per-flat, then × unsold.
  // Using unrounded per-flat × 19 produced ₹52,672.02 vs UI ₹52,671.99.
  const perFlat = roundRupeePaise(
    computePerFlatShare(totalCommonExpense, COMMON_EXPENSE_TOTAL_FLATS)
  );
  const share = roundRupeePaise(perFlat * unsold);
  const collectedRounded = roundRupeePaise(collected);
  return {
    share,
    collected: collectedRounded,
    pending: Math.max(0, roundRupeePaise(share - collectedRounded)),
    configured: configuredUnsoldFlats !== null,
  };
}

async function assertWithinMonthPending(params: {
  month: number;
  year: number;
  amount: number;
  excludeId?: string;
  unsoldFlats?: number;
}): Promise<{ ok: true; pending: number; share: number } | { ok: false; message: string }> {
  const row = await getMonthBuilderPending(params);
  if (!row.configured) {
    return { ok: false, message: "Unsold Flats are not set for this month" };
  }
  if (row.share <= 0) {
    return {
      ok: false,
      message: "No Builder Share for this month — add common expenses first",
    };
  }
  if (roundRupeePaise(params.amount) > row.pending + 0.01) {
    return {
      ok: false,
      message: `Amount exceeds Builder Pending (pending ₹${row.pending.toLocaleString("en-IN")}, share ₹${row.share.toLocaleString("en-IN")})`,
    };
  }
  return { ok: true, pending: row.pending, share: row.share };
}

export async function createBuilderCommonCollection(
  body: Record<string, unknown>,
  createdBy?: string | null
): Promise<BuilderCommonCollectionRecord> {
  const validated = validateInput(body);
  if (!validated.ok) throw new Error(validated.message);

  const data = {
    ...validated.data,
    expenseCategory: BUILDER_MONTHLY_COLLECTION_LABEL,
  };
  const check = await assertWithinMonthPending({
    month: data.month,
    year: data.year,
    amount: data.amount,
    unsoldFlats: data.unsoldFlats,
  });
  if (!check.ok) throw new Error(check.message);

  await setMonthlyUnsoldFlats(data.month, data.year, data.unsoldFlats);

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

  const data = {
    ...validated.data,
    expenseCategory: BUILDER_MONTHLY_COLLECTION_LABEL,
  };
  const check = await assertWithinMonthPending({
    month: data.month,
    year: data.year,
    amount: data.amount,
    excludeId: id,
    unsoldFlats: data.unsoldFlats,
  });
  if (!check.ok) throw new Error(check.message);

  await setMonthlyUnsoldFlats(data.month, data.year, data.unsoldFlats);

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
