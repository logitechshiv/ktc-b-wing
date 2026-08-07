import type { DbExpensePaymentMethod } from "@/lib/expense-constants";
import { EXPENSE_PAYMENT_METHODS } from "@/lib/expense-constants";

export function serializeExpense(doc: {
  _id: { toString(): string };
  category: string;
  /** @deprecated legacy English title */
  expenseTitle?: string | null;
  expenseTitleGujarati?: string | null;
  amount: number;
  displayOrder?: number | null;
  paymentMethod: DbExpensePaymentMethod;
  expenseDate: Date;
  billImage?: string | null;
  notes?: string | null;
  whatsappShared?: boolean | null;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const expenseTitleGujarati =
    String(doc.expenseTitleGujarati || "").trim() ||
    String(doc.expenseTitle || "").trim();

  return {
    id: doc._id.toString(),
    category: doc.category || "",
    expenseTitleGujarati,
    amount: Number(doc.amount) || 0,
    displayOrder: Number(doc.displayOrder) || 0,
    paymentMethod: (doc.paymentMethod || "cash") as DbExpensePaymentMethod,
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
  expenseTitleGujarati: string;
  amount: number;
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
  const expenseTitleGujarati =
    String(body.expenseTitleGujarati ?? "").trim() ||
    String(body.expenseTitle ?? "").trim();
  const amount = Number(body.amount);
  const paymentMethod = String(body.paymentMethod ?? "")
    .trim()
    .toLowerCase() as DbExpensePaymentMethod;
  const billImage = String(body.billImage ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const whatsappShared = body.whatsappShared === true || body.whatsappShared === "true";
  const dateRaw = body.expenseDate ? String(body.expenseDate) : new Date().toISOString();
  const expenseDate = new Date(dateRaw);

  if (!category) return { ok: false, message: "Category is required" };
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

  return {
    ok: true,
    data: {
      category,
      expenseTitleGujarati,
      amount,
      paymentMethod,
      expenseDate,
      billImage,
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
