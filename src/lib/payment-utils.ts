import type { DbPaymentMode } from "@/models/Payment";
import { PAYMENT_MODES } from "@/models/Payment";

/** Resolve amount-per-flat from new or legacy purpose documents. */
export function purposeAmountPerFlat(doc: {
  amountPerFlat?: number | null;
  amount?: number | null;
}): number {
  if (doc.amountPerFlat != null && Number.isFinite(Number(doc.amountPerFlat))) {
    return Number(doc.amountPerFlat) || 0;
  }
  return Number(doc.amount) || 0;
}

export function serializePurpose(doc: {
  _id: { toString(): string };
  title: string;
  amountPerFlat?: number | null;
  /** @deprecated legacy field */
  amount?: number | null;
  description?: string | null;
  isActive?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const amountPerFlat = purposeAmountPerFlat(doc);
  return {
    id: doc._id.toString(),
    title: doc.title || "",
    amountPerFlat,
    /** Alias kept for existing UI / clients */
    amount: amountPerFlat,
    description: doc.description || "",
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializePayment(doc: {
  _id: { toString(): string };
  flatId: { toString(): string };
  floorNumber: number;
  flatNumber: string;
  ownerName?: string | null;
  ownerType?: string | null;
  paymentPurposeId: { toString(): string };
  paymentPurpose: string;
  amount: number;
  paymentMode: DbPaymentMode;
  paymentDate: Date;
  paymentSource?: string | null;
  whatsappSent?: boolean | null;
  notes?: string | null;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const paymentSource =
    String(doc.paymentSource || "").toLowerCase() === "builder" ? "builder" : "owner";
  const ownerTypeRaw = String(doc.ownerType || "").trim();
  const ownerType =
    ownerTypeRaw === "Owner" || ownerTypeRaw === "Renter" ? ownerTypeRaw : "";
  return {
    id: doc._id.toString(),
    flatId: doc.flatId.toString(),
    floorNumber: doc.floorNumber,
    flatNumber: doc.flatNumber,
    ownerName: doc.ownerName || "",
    ownerType,
    paymentPurposeId: doc.paymentPurposeId.toString(),
    paymentPurpose: doc.paymentPurpose || "",
    amount: Number(doc.amount) || 0,
    paymentMode: doc.paymentMode,
    paymentDate: doc.paymentDate,
    paymentSource,
    whatsappSent: !!doc.whatsappSent,
    notes: doc.notes || "",
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface PurposePayload {
  title: string;
  amountPerFlat: number;
  description: string;
  isActive: boolean;
}

export function validatePurposePayload(
  body: Record<string, unknown>
): { ok: true; data: PurposePayload } | { ok: false; message: string } {
  const title = String(body.title ?? "").trim();
  // amount accepted as alias for amountPerFlat
  const amountPerFlat = Number(
    body.amountPerFlat != null && body.amountPerFlat !== ""
      ? body.amountPerFlat
      : body.amount != null
        ? body.amount
        : NaN
  );
  const description = String(body.description ?? "").trim();
  const isActive = body.isActive !== false && body.isActive !== "false";

  if (!title) return { ok: false, message: "Purpose title is required" };
  if (!Number.isFinite(amountPerFlat) || amountPerFlat < 0) {
    return { ok: false, message: "Amount Per Flat must be a valid number" };
  }

  return { ok: true, data: { title, amountPerFlat, description, isActive } };
}

export interface PaymentPayload {
  flatId: string;
  floorNumber: number;
  flatNumber: string;
  ownerName: string;
  paymentPurposeId: string;
  paymentPurpose: string;
  amount: number;
  paymentMode: DbPaymentMode;
  paymentDate: Date;
  whatsappSent: boolean;
  notes: string;
}

export function validatePaymentPayload(
  body: Record<string, unknown>
): { ok: true; data: PaymentPayload } | { ok: false; message: string } {
  const flatId = String(body.flatId ?? "").trim();
  const floorNumber = Number(body.floorNumber);
  const flatNumber = String(body.flatNumber ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();
  // purposeId accepted as alias for paymentPurposeId
  const paymentPurposeId = String(body.paymentPurposeId ?? body.purposeId ?? "").trim();
  const paymentPurpose = String(body.paymentPurpose ?? "").trim();
  const amount = Number(body.amount);
  // paymentMethod accepted as alias for paymentMode
  const paymentMode = String(body.paymentMode ?? body.paymentMethod ?? "")
    .trim()
    .toLowerCase() as DbPaymentMode;
  const notes = String(body.notes ?? "").trim();
  const whatsappSent = body.whatsappSent === true || body.whatsappSent === "true";

  const dateRaw = body.paymentDate ? String(body.paymentDate) : new Date().toISOString();
  const paymentDate = new Date(dateRaw);

  if (!flatId) return { ok: false, message: "Flat is required" };
  if (!flatNumber) return { ok: false, message: "Flat Number is required" };
  if (!floorNumber || floorNumber < 1 || floorNumber > 13) {
    return { ok: false, message: "Floor Number is required" };
  }
  if (!paymentPurposeId) return { ok: false, message: "Payment Purpose is required" };
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return { ok: false, message: "Payment Mode must be cash, bank or upi" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0" };
  }
  if (Number.isNaN(paymentDate.getTime())) {
    return { ok: false, message: "Payment Date is invalid" };
  }

  return {
    ok: true,
    data: {
      flatId,
      floorNumber,
      flatNumber,
      ownerName,
      paymentPurposeId,
      paymentPurpose,
      amount,
      paymentMode,
      paymentDate,
      whatsappSent,
      notes,
    },
  };
}

export function shortPurposeTitle(title: string) {
  return title
    .replace("Monthly Maintenance — ", "")
    .replace("Monthly Maintenance - ", "")
    .replace(" Repair Fund ", " ")
    .trim();
}
