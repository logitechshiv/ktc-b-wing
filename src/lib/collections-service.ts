import mongoose from "mongoose";
import Payment from "@/models/Payment";
import PaymentPurpose from "@/models/PaymentPurpose";
import Flat from "@/models/Flat";
import { purposeAmountPerFlat, serializePayment, serializePurpose } from "@/lib/payment-utils";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

export type CollectionStatusFilter = "all" | "paid" | "pending";

/** Flats that can pay: sold + non-empty owner name. */
export async function countPayableFlats(): Promise<number> {
  return Flat.countDocuments({
    status: "sold",
    ownerName: { $exists: true, $nin: [null, ""] },
  });
}

export interface PurposeProgressStat {
  purposeId: string;
  total: number;
  collected: number;
  pending: number;
  pendingAmount: number;
  collectedAmount: number;
  collectionPercent: number;
}

/**
 * Per-purpose progress using aggregation (distinct paid flats + collected sum).
 */
export async function getPurposeProgressStats(
  purposes: Array<{ id: string; amount: number }>
): Promise<PurposeProgressStat[]> {
  if (purposes.length === 0) return [];

  const payableFlats = await countPayableFlats();
  const ids = purposes
    .map((p) => p.id)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const paidAgg =
    ids.length === 0
      ? []
      : await Payment.aggregate([
          { $match: { paymentPurposeId: { $in: ids } } },
          {
            $group: {
              _id: "$paymentPurposeId",
              paidFlats: { $addToSet: "$flatNumber" },
              collectedAmount: { $sum: "$amount" },
            },
          },
        ]);

  const paidMap = new Map(
    paidAgg.map((row) => [
      String(row._id),
      {
        paidFlats: (row.paidFlats as string[]).length,
        collectedAmount: Number(row.collectedAmount) || 0,
      },
    ])
  );

  return purposes.map((p) => {
    const stats = paidMap.get(p.id) || { paidFlats: 0, collectedAmount: 0 };
    const pending = Math.max(0, payableFlats - stats.paidFlats);
    const collectionPercent =
      payableFlats > 0 ? Math.round((stats.paidFlats / payableFlats) * 100) : 0;
    return {
      purposeId: p.id,
      total: payableFlats,
      collected: stats.paidFlats,
      pending,
      pendingAmount: pending * (p.amount || 0),
      collectedAmount: stats.collectedAmount,
      collectionPercent,
    };
  });
}

export interface PurposeDetailsResult {
  purpose: ReturnType<typeof serializePurpose>;
  summary: {
    totalFlats: number;
    paidFlats: number;
    pendingFlats: number;
    noOwnerFlats: number;
    totalCollected: number;
    totalPending: number;
    collectionPercent: number;
  };
  paid: Array<{
    flatId: string;
    flatNumber: string;
    floorNumber: number;
    ownerName: string;
    ownerMobile: string;
    hasOwner: boolean;
    amount: number;
    paymentDate: Date | string;
    paymentMode: string;
    paymentId: string;
    whatsappSent: boolean;
  }>;
  pending: Array<{
    flatId: string;
    flatNumber: string;
    floorNumber: number;
    ownerName: string;
    ownerMobile: string;
    hasOwner: boolean;
    pendingAmount: number;
  }>;
}

/** Paid / pending breakdown for one purpose (round). */
export async function getPurposeDetails(purposeId: string): Promise<PurposeDetailsResult | null> {
  if (!mongoose.Types.ObjectId.isValid(purposeId)) return null;

  const purpose = await PaymentPurpose.findById(purposeId).lean();
  if (!purpose) return null;

  const oid = purpose._id;
  const [allFlats, paymentDocs] = await Promise.all([
    Flat.find({}).sort({ floorNumber: 1, flatNumber: 1 }).lean(),
    Payment.find({ paymentPurposeId: oid }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
  ]);

  const paidByFlat = new Map<string, (typeof paymentDocs)[number]>();
  for (const pay of paymentDocs) {
    const key = String(pay.flatNumber);
    if (!paidByFlat.has(key)) paidByFlat.set(key, pay);
  }

  const paid: PurposeDetailsResult["paid"] = [];
  const pending: PurposeDetailsResult["pending"] = [];
  let totalCollected = 0;
  let pendingWithOwner = 0;
  let payableFlats = 0;
  const amountPerFlat = purposeAmountPerFlat(purpose as { amountPerFlat?: number; amount?: number });

  for (const flat of allFlats) {
    const flatNumber = String(flat.flatNumber);
    const payment = paidByFlat.get(flatNumber);
    const ownerName = (flat.ownerName || "").trim();
    const ownerMobile = flat.ownerMobile || "";
    const hasOwner = !!ownerName;
    const isSoldWithOwner = flat.status === "sold" && hasOwner;

    // Pending / payable counts only include Sold flats with a real owner
    if (isSoldWithOwner) {
      payableFlats += 1;
    }

    if (payment) {
      const serialized = serializePayment(payment as never);
      totalCollected += serialized.amount;
      paid.push({
        flatId: flat._id.toString(),
        flatNumber,
        floorNumber: flat.floorNumber,
        ownerName: (serialized.ownerName || ownerName).trim() || ownerName,
        ownerMobile,
        hasOwner: !!(serialized.ownerName || ownerName).trim(),
        amount: serialized.amount,
        paymentDate: serialized.paymentDate,
        paymentMode: serialized.paymentMode,
        paymentId: serialized.id,
        whatsappSent: serialized.whatsappSent,
      });
      continue;
    }

    // બાકી રકમ: Sold + owner + unpaid only — never Available / Unsold / No Owner
    if (!isSoldWithOwner) continue;

    pendingWithOwner += 1;
    pending.push({
      flatId: flat._id.toString(),
      flatNumber,
      floorNumber: flat.floorNumber,
      ownerName,
      ownerMobile,
      hasOwner: true,
      pendingAmount: amountPerFlat,
    });
  }

  const paidAmongPayable = paid.filter((row) => {
    const flat = allFlats.find((f) => String(f.flatNumber) === row.flatNumber);
    return flat?.status === "sold" && !!(flat.ownerName || "").trim();
  }).length;
  const collectionPercent =
    payableFlats > 0 ? Math.round((paidAmongPayable / payableFlats) * 100) : 0;

  return {
    purpose: serializePurpose(purpose as never),
    summary: {
      totalFlats: payableFlats,
      paidFlats: paidAmongPayable,
      pendingFlats: pendingWithOwner,
      noOwnerFlats: 0,
      totalCollected,
      totalPending: pendingWithOwner * amountPerFlat,
      collectionPercent,
    },
    paid,
    pending,
  };
}

export interface ListPaymentsParams {
  q?: string;
  purposeId?: string;
  mode?: string;
  /** When set, only return groups for this purpose (required for purpose-scoped history). */
  requirePurpose?: boolean;
}

export interface PaymentGroupResult {
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
  collectionPercent: number;
  payments: ReturnType<typeof serializePayment>[];
}

/**
 * List payments + purpose groups. When purposeId is provided, history is scoped to that round only.
 */
export async function listPaymentsGrouped(params: ListPaymentsParams = {}): Promise<{
  payments: ReturnType<typeof serializePayment>[];
  groups: PaymentGroupResult[];
  shownTotal: number;
  summary: { totalPayments: number; totalCollection: number };
}> {
  const q = (params.q || "").trim();
  const purposeId = (params.purposeId || "").trim();
  const mode = (params.mode || "").trim().toLowerCase();

  const filter: Record<string, unknown> = {};

  if (purposeId && mongoose.Types.ObjectId.isValid(purposeId)) {
    filter.paymentPurposeId = purposeId;
  }
  if (mode && PAYMENT_MODES.includes(mode as DbPaymentMode)) {
    filter.paymentMode = mode;
  }
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ flatNumber: regex }, { ownerName: regex }];
  }

  const purposeFilter =
    purposeId && mongoose.Types.ObjectId.isValid(purposeId) ? { _id: purposeId } : {};

  const [docs, purposeDocs, payableFlats] = await Promise.all([
    Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).lean(),
    PaymentPurpose.find(purposeFilter).sort({ createdAt: -1 }).lean(),
    countPayableFlats(),
  ]);

  const payments = docs.map((d) => serializePayment(d as never));
  const shownTotal = payments.reduce((s, p) => s + p.amount, 0);

  const purposeIds = purposeDocs.map((p) => p._id);
  const paidAgg =
    purposeIds.length === 0
      ? []
      : await Payment.aggregate([
          { $match: { paymentPurposeId: { $in: purposeIds } } },
          {
            $group: {
              _id: "$paymentPurposeId",
              paidFlats: { $addToSet: "$flatNumber" },
              collected: { $sum: "$amount" },
            },
          },
        ]);

  const paidMap = new Map(
    paidAgg.map((row) => [
      String(row._id),
      {
        paidFlats: (row.paidFlats as string[]).length,
        collected: Number(row.collected) || 0,
      },
    ])
  );

  const groups: PaymentGroupResult[] = purposeDocs.map((purpose) => {
    const id = purpose._id.toString();
    const stats = paidMap.get(id) || { paidFlats: 0, collected: 0 };
    const pending = Math.max(0, payableFlats - stats.paidFlats);
    const groupPayments = payments.filter((p) => p.paymentPurposeId === id);
    const collectionPercent =
      payableFlats > 0 ? Math.round((stats.paidFlats / payableFlats) * 100) : 0;
    const amountPerFlat = purposeAmountPerFlat(
      purpose as { amountPerFlat?: number; amount?: number }
    );

    return {
      purposeId: id,
      title: purpose.title,
      amount: amountPerFlat,
      description: purpose.description || "",
      isActive: purpose.isActive !== false,
      totalFlats: payableFlats,
      paid: stats.paidFlats,
      pending,
      collected: stats.collected,
      pendingAmount: pending * amountPerFlat,
      collectionPercent,
      payments: groupPayments,
    };
  });

  const summaryFilter =
    purposeId && mongoose.Types.ObjectId.isValid(purposeId)
      ? { paymentPurposeId: new mongoose.Types.ObjectId(purposeId) }
      : {};

  const [scopedCount, scopedAgg] = await Promise.all([
    Payment.countDocuments(summaryFilter),
    Payment.aggregate([
      ...(Object.keys(summaryFilter).length ? [{ $match: summaryFilter }] : []),
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    payments,
    groups,
    shownTotal,
    summary: {
      totalPayments: scopedCount,
      totalCollection: scopedAgg[0]?.total ?? 0,
    },
  };
}

/** True if this flat already paid for the purpose. */
export async function hasExistingPayment(purposeId: string, flatNumber: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(purposeId)) return false;
  const count = await Payment.countDocuments({
    paymentPurposeId: purposeId,
    flatNumber: String(flatNumber).trim(),
  });
  return count > 0;
}
