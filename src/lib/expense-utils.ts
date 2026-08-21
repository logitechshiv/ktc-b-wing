import type { DbExpensePaymentMethod, DbExpenseType } from "@/lib/expense-constants";
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_TYPES,
  parseExpenseType,
} from "@/lib/expense-constants";

export { parseExpenseType, EXPENSE_TYPE_OPTIONS, EXPENSE_TYPES } from "@/lib/expense-constants";
export type { DbExpenseType } from "@/lib/expense-constants";

export const MAX_EXPENSE_BILL_DOCUMENTS = 10;

/** Normalize legacy `billImage` + `billImages[]` into a unique URL list. */
export function normalizeBillImages(input: {
  billImage?: unknown;
  billImages?: unknown;
}): string[] {
  const fromArray = Array.isArray(input.billImages)
    ? input.billImages.map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const single = String(input.billImage ?? "").trim();
  const merged = [...fromArray];
  if (single && !merged.includes(single)) {
    merged.unshift(single);
  }
  // de-dupe while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of merged) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
    if (unique.length >= MAX_EXPENSE_BILL_DOCUMENTS) break;
  }
  return unique;
}

/** Prefer createdAt; fall back to ObjectId generation time for legacy rows. */
export function resolveExpenseCreatedAt(doc: {
  _id?: { getTimestamp?: () => Date; toString(): string } | null;
  createdAt?: Date | string | null;
}): Date {
  if (doc.createdAt) {
    const d = new Date(doc.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (doc._id && typeof doc._id.getTimestamp === "function") {
    try {
      return doc._id.getTimestamp();
    } catch {
      /* ignore */
    }
  }
  return new Date(0);
}

/** Newest created → oldest created (stable by id). */
export function compareExpensesByCreatedAtDesc(
  a: { id?: string; createdAt?: Date | string | null },
  b: { id?: string; createdAt?: Date | string | null }
): number {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (ta !== tb) return tb - ta;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

export function serializeExpense(doc: {
  _id: { toString(): string; getTimestamp?: () => Date };
  category: string;
  expenseType?: string | null;
  /** @deprecated legacy English title */
  expenseTitle?: string | null;
  expenseTitleGujarati?: string | null;
  amount: number;
  displayOrder?: number | null;
  paymentMethod: DbExpensePaymentMethod;
  expenseDate: Date;
  billImage?: string | null;
  billImages?: string[] | null;
  notes?: string | null;
  whatsappShared?: boolean | null;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const expenseTitleGujarati =
    String(doc.expenseTitleGujarati || "").trim() ||
    String(doc.expenseTitle || "").trim();

  const billImages = normalizeBillImages({
    billImage: doc.billImage,
    billImages: doc.billImages,
  });

  return {
    id: doc._id.toString(),
    category: doc.category || "",
    expenseType: parseExpenseType(doc.expenseType),
    expenseTitleGujarati,
    amount: Number(doc.amount) || 0,
    displayOrder: Number(doc.displayOrder) || 0,
    paymentMethod: (doc.paymentMethod || "cash") as DbExpensePaymentMethod,
    expenseDate: doc.expenseDate,
    billImage: billImages[0] || "",
    billImages,
    notes: doc.notes || "",
    whatsappShared: !!doc.whatsappShared,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: resolveExpenseCreatedAt(doc),
    updatedAt: doc.updatedAt,
  };
}

export interface ExpensePayload {
  category: string;
  expenseType: DbExpenseType;
  expenseTitleGujarati: string;
  amount: number;
  paymentMethod: DbExpensePaymentMethod;
  expenseDate: Date;
  billImage: string;
  billImages: string[];
  notes: string;
  whatsappShared: boolean;
}

export function validateExpensePayload(
  body: Record<string, unknown>
): { ok: true; data: ExpensePayload } | { ok: false; message: string } {
  const category = String(body.category ?? "").trim();
  const expenseType = parseExpenseType(body.expenseType);
  const expenseTitleGujarati =
    String(body.expenseTitleGujarati ?? "").trim() ||
    String(body.expenseTitle ?? "").trim();
  const amount = Number(body.amount);
  const paymentMethod = String(body.paymentMethod ?? "")
    .trim()
    .toLowerCase() as DbExpensePaymentMethod;
  const notes = String(body.notes ?? "").trim();
  const whatsappShared = body.whatsappShared === true || body.whatsappShared === "true";
  const dateRaw = body.expenseDate ? String(body.expenseDate) : new Date().toISOString();
  const expenseDate = new Date(dateRaw);

  const billImages = normalizeBillImages({
    billImage: body.billImage,
    billImages: body.billImages,
  });

  if (!category) return { ok: false, message: "Category is required" };
  if (!expenseType || !EXPENSE_TYPES.includes(expenseType)) {
    return {
      ok: false,
      message: "Expense Type is required (General Expense or Common Expense)",
    };
  }
  if (!expenseTitleGujarati) {
    return { ok: false, message: "Expense Title (Gujarati) is required" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (!EXPENSE_PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, message: "Payment Method is required" };
  }
  if (Number.isNaN(expenseDate.getTime())) {
    return { ok: false, message: "Expense Date is invalid" };
  }
  if (billImages.length > MAX_EXPENSE_BILL_DOCUMENTS) {
    return {
      ok: false,
      message: `You can attach up to ${MAX_EXPENSE_BILL_DOCUMENTS} documents`,
    };
  }

  return {
    ok: true,
    data: {
      category,
      expenseType,
      expenseTitleGujarati,
      amount,
      paymentMethod,
      expenseDate,
      billImage: billImages[0] || "",
      billImages,
      notes,
      whatsappShared,
    },
  };
}

export function displayExpenseTitle(titleGu?: string | null, fallback?: string | null) {
  const gu = (titleGu || "").trim();
  if (gu) return gu;
  return (fallback || "").trim() || "—";
}
