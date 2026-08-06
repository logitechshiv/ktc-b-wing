export type PaymentMode = "cash" | "bank" | "upi";

export interface PaymentRecord {
  id: string;
  flatId: string;
  floorNumber: number;
  flatNumber: string;
  ownerName: string;
  paymentPurposeId: string;
  paymentPurpose: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  whatsappSent: boolean;
  notes: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentSummary {
  totalPayments: number;
  totalCollection: number;
}

export interface PurposePaymentGroup {
  purposeId: string;
  title: string;
  amount: number;
  description: string;
  isActive: boolean;
  totalFlats: number;
  paid: number;
  pending: number;
  collected: number;
  pendingAmount: number;
  collectionPercent?: number;
  payments: PaymentRecord[];
}

export interface PaymentListParams {
  q?: string;
  purposeId?: string | "all";
  mode?: PaymentMode | "all";
}

export interface PaymentInput {
  flatId: string;
  floorNumber: number;
  flatNumber: string;
  ownerName?: string;
  paymentPurposeId: string;
  paymentPurpose?: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate?: string;
  whatsappSent?: boolean;
  notes?: string;
}

function toPayment(raw: Record<string, unknown>): PaymentRecord {
  return {
    id: String(raw.id ?? raw._id),
    flatId: String(raw.flatId ?? ""),
    floorNumber: Number(raw.floorNumber) || 0,
    flatNumber: String(raw.flatNumber ?? ""),
    ownerName: String(raw.ownerName ?? ""),
    paymentPurposeId: String(raw.paymentPurposeId ?? ""),
    paymentPurpose: String(raw.paymentPurpose ?? ""),
    amount: Number(raw.amount) || 0,
    paymentMode: (raw.paymentMode as PaymentMode) || "cash",
    paymentDate: raw.paymentDate ? String(raw.paymentDate).slice(0, 10) : "",
    whatsappSent: !!raw.whatsappSent,
    notes: String(raw.notes ?? ""),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
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

export async function readPayments(params: PaymentListParams = {}): Promise<{
  payments: PaymentRecord[];
  groups: PurposePaymentGroup[];
  shownTotal: number;
  summary: PaymentSummary;
}> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.purposeId && params.purposeId !== "all") sp.set("purposeId", params.purposeId);
  if (params.mode && params.mode !== "all") sp.set("mode", params.mode);

  const res = await fetch(`/api/payments?${sp.toString()}`, { cache: "no-store" });
  const data = await parseJson(res);

  const groups: PurposePaymentGroup[] = ((data.groups as Record<string, unknown>[]) || []).map((g) => ({
    purposeId: String(g.purposeId ?? ""),
    title: String(g.title ?? ""),
    amount: Number(g.amount) || 0,
    description: String(g.description ?? ""),
    isActive: g.isActive !== false,
    totalFlats: Number(g.totalFlats) || 0,
    paid: Number(g.paid) || 0,
    pending: Number(g.pending) || 0,
    collected: Number(g.collected) || 0,
    pendingAmount: Number(g.pendingAmount) || 0,
    collectionPercent: Number(g.collectionPercent) || 0,
    payments: ((g.payments as Record<string, unknown>[]) || []).map(toPayment),
  }));

  return {
    payments: ((data.payments as Record<string, unknown>[]) || []).map(toPayment),
    groups,
    shownTotal: Number(data.shownTotal) || 0,
    summary: (data.summary as PaymentSummary) || { totalPayments: 0, totalCollection: 0 },
  };
}

export async function createPayment(input: PaymentInput): Promise<PaymentRecord> {
  const res = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toPayment(data.payment);
}

export async function updatePayment(id: string, input: PaymentInput): Promise<PaymentRecord> {
  if (!id) throw new Error("Missing payment id");
  const res = await fetch(`/api/payments/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toPayment(data.payment);
}

export async function markPaymentWhatsappSent(id: string): Promise<PaymentRecord> {
  const res = await fetch(`/api/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ whatsappSent: true }),
  });
  const data = await parseJson(res);
  return toPayment(data.payment);
}

export async function deletePayment(id: string): Promise<void> {
  const res = await fetch(`/api/payments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}
