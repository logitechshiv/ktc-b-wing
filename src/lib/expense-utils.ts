import type { DbExpenseMethod, DbExpensePaymentMethod } from "@/lib/expense-constants";
import { EXPENSE_METHODS, EXPENSE_PAYMENT_METHODS } from "@/lib/expense-constants";

export function serializeExpense(doc: {
  _id: { toString(): string };
  category: string;
  expenseTitle: string;
  expenseTitleGujarati?: string | null;
  amount: number;
  displayOrder?: number | null;
  expenseMethod: DbExpenseMethod;
  collectionPurposeId?: { toString(): string } | null;
  collectionPurposeName?: string | null;
  paymentMethod: DbExpensePaymentMethod;
  expenseDate: Date;
  billImage?: string | null;
  notes?: string | null;
  whatsappShared?: boolean | null;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    category: doc.category || "",
    expenseTitle: doc.expenseTitle || "",
    expenseTitleGujarati: doc.expenseTitleGujarati || "",
    amount: Number(doc.amount) || 0,
    displayOrder: Number(doc.displayOrder) || 0,
    expenseMethod: doc.expenseMethod,
    collectionPurposeId: doc.collectionPurposeId ? doc.collectionPurposeId.toString() : null,
    collectionPurposeName: doc.collectionPurposeName || "",
    paymentMethod: doc.paymentMethod,
    expenseDate: doc.expenseDate,
    billImage: doc.billImage || "",
    notes: doc.notes || "",
    whatsappShared: !!doc.whatsappShared,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface ExpensePayload {
  category: string;
  expenseTitle: string;
  expenseTitleGujarati: string;
  amount: number;
  expenseMethod: DbExpenseMethod;
  collectionPurposeId: string | null;
  collectionPurposeName: string;
  paymentMethod: DbExpensePaymentMethod;
  expenseDate: Date;
  billImage: string;
  notes: string;
  whatsappShared: boolean;
}

export function validateExpensePayload(
  body: Record<string, unknown>
): { ok: true; data: ExpensePayload } | { ok: false; message: string } {
  const category = String(body.category ?? "").trim();
  const expenseTitle = String(body.expenseTitle ?? "").trim();
  const expenseTitleGujarati = String(body.expenseTitleGujarati ?? "").trim();
  const amount = Number(body.amount);
  const expenseMethod = String(body.expenseMethod ?? "").trim().toLowerCase() as DbExpenseMethod;
  const collectionPurposeIdRaw = String(body.collectionPurposeId ?? "").trim();
  const collectionPurposeName = String(body.collectionPurposeName ?? "").trim();
  const paymentMethod = String(body.paymentMethod ?? "").trim().toLowerCase() as DbExpensePaymentMethod;
  const billImage = String(body.billImage ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const whatsappShared = body.whatsappShared === true || body.whatsappShared === "true";
  const dateRaw = body.expenseDate ? String(body.expenseDate) : new Date().toISOString();
  const expenseDate = new Date(dateRaw);

  if (!category) return { ok: false, message: "Category is required" };
  if (!expenseTitle && !expenseTitleGujarati) {
    return { ok: false, message: "Expense Title is required" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (!EXPENSE_METHODS.includes(expenseMethod)) {
    return { ok: false, message: "Expense Method is required" };
  }
  if (!EXPENSE_PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, message: "Payment Method is required" };
  }
  if (Number.isNaN(expenseDate.getTime())) {
    return { ok: false, message: "Expense Date is invalid" };
  }
  if (expenseMethod === "collection" && !collectionPurposeIdRaw) {
    return { ok: false, message: "Purpose is required when expense is from collection" };
  }

  return {
    ok: true,
    data: {
      category,
      expenseTitle: expenseTitle || expenseTitleGujarati,
      expenseTitleGujarati,
      amount,
      expenseMethod,
      collectionPurposeId: expenseMethod === "collection" ? collectionPurposeIdRaw : null,
      collectionPurposeName: expenseMethod === "collection" ? collectionPurposeName : "",
      paymentMethod,
      expenseDate,
      billImage,
      notes,
      whatsappShared,
    },
  };
}

export function displayExpenseTitle(title?: string | null, titleGu?: string | null) {
  const gu = (titleGu || "").trim();
  if (gu) return gu;
  return (title || "").trim() || "—";
}
