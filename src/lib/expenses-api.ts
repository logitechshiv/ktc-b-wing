import { compareExpensesByCreatedAtDesc } from "@/lib/expense-utils";
import { CacheKeys, cachedQuery } from "@/lib/data-cache";
import {
  parseExpenseCategoryRole,
  type ExpenseCategoryRole,
} from "@/lib/expense-category-role";

export type ExpensePaymentMethod = "cash" | "bank" | "upi" | "cheque";

export type { ExpenseCategoryRole };

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  includeInCommonExpense: boolean;
  role: ExpenseCategoryRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  expenseTitleGujarati: string;
  amount: number;
  displayOrder: number;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  billImage: string;
  billImages: string[];
  notes: string;
  whatsappShared: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseInput {
  category: string;
  expenseTitleGujarati: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  expenseDate?: string;
  billImage?: string;
  billImages?: string[];
  notes?: string;
  whatsappShared?: boolean;
}

export interface ExpenseListParams {
  q?: string;
  category?: string | "all";
}

function normalizeClientBillImages(raw: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(raw.billImages)
    ? raw.billImages.map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const single = String(raw.billImage ?? "").trim();
  const merged = [...fromArray];
  if (single && !merged.includes(single)) merged.unshift(single);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of merged) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function toExpense(raw: Record<string, unknown>): ExpenseRecord {
  const billImages = normalizeClientBillImages(raw);
  return {
    id: String(raw.id ?? raw._id),
    category: String(raw.category ?? ""),
    expenseTitleGujarati:
      String(raw.expenseTitleGujarati ?? "").trim() || String(raw.expenseTitle ?? "").trim(),
    amount: Number(raw.amount) || 0,
    displayOrder: Number(raw.displayOrder) || 0,
    paymentMethod: (raw.paymentMethod as ExpensePaymentMethod) || "cash",
    expenseDate: raw.expenseDate ? String(raw.expenseDate).slice(0, 10) : "",
    billImage: billImages[0] || "",
    billImages,
    notes: String(raw.notes ?? ""),
    whatsappShared: !!raw.whatsappShared,
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

function toCategory(raw: Record<string, unknown>): ExpenseCategoryRecord {
  return {
    id: String(raw.id ?? raw._id),
    name: String(raw.name ?? ""),
    includeInCommonExpense: raw.includeInCommonExpense === true,
    role: parseExpenseCategoryRole(raw.role, "normal"),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function readExpenseCategories(opts?: {
  force?: boolean;
}): Promise<ExpenseCategoryRecord[]> {
  return cachedQuery(
    CacheKeys.expenseCategories(),
    async () => {
      const res = await fetch("/api/expense-categories", { cache: "no-store" });
      const data = await parseJson(res);
      return ((data.categories as Record<string, unknown>[]) || []).map(toCategory);
    },
    { force: opts?.force }
  );
}

export async function createExpenseCategory(
  name: string,
  includeInCommonExpense = false,
  role: ExpenseCategoryRole = "normal"
): Promise<ExpenseCategoryRecord> {
  const res = await fetch("/api/expense-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ name, includeInCommonExpense, role }),
  });
  const data = await parseJson(res);
  return toCategory(data.category);
}

export async function updateExpenseCategory(
  id: string,
  name: string,
  includeInCommonExpense = false,
  role: ExpenseCategoryRole = "normal"
): Promise<ExpenseCategoryRecord> {
  const res = await fetch(`/api/expense-categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ name, includeInCommonExpense, role }),
  });
  const data = await parseJson(res);
  return toCategory(data.category);
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const res = await fetch(`/api/expense-categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}

export async function readExpenses(
  params: ExpenseListParams & { force?: boolean } = {}
): Promise<{
  expenses: ExpenseRecord[];
  shownTotal: number;
  categories: string[];
  nextDisplayOrder: number;
  summary: { totalExpenses: number; totalAmount: number };
}> {
  const q = params.q?.trim() || "";
  const category = params.category || "all";
  return cachedQuery(
    CacheKeys.expenses(q, category),
    async () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (category !== "all") sp.set("category", category);

      const res = await fetch(`/api/expenses?${sp.toString()}`, { cache: "no-store" });
      const data = await parseJson(res);
      const expenses = ((data.expenses as Record<string, unknown>[]) || [])
        .map(toExpense)
        .sort(compareExpensesByCreatedAtDesc);
      return {
        expenses,
        shownTotal: Number(data.shownTotal) || 0,
        categories: (data.categories as string[]) || [],
        nextDisplayOrder: Number(data.nextDisplayOrder) || 1,
        summary: data.summary || { totalExpenses: 0, totalAmount: 0 },
      };
    },
    { force: params.force }
  );
}

export async function createExpense(input: ExpenseInput): Promise<ExpenseRecord> {
  const res = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toExpense(data.expense);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ExpenseRecord> {
  const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toExpense(data.expense);
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}

export async function markExpenseWhatsappShared(id: string): Promise<ExpenseRecord> {
  const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ whatsappShared: true }),
  });
  const data = await parseJson(res);
  return toExpense(data.expense);
}

export async function uploadExpenseBill(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/expenses/upload", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    body: form,
  });
  const data = await parseJson(res);
  return String(data.url || "");
}

export async function reorderExpenses(
  items: Array<{ id: string; displayOrder: number }>
): Promise<ExpenseRecord[]> {
  const res = await fetch("/api/expenses/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(
      items.map((item) => ({
        _id: item.id,
        displayOrder: item.displayOrder,
      }))
    ),
  });
  const data = await parseJson(res);
  return ((data.expenses as Record<string, unknown>[]) || []).map(toExpense);
}
