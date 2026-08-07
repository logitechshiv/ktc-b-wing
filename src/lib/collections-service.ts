import mongoose from "mongoose";
import Payment from "@/models/Payment";
import PaymentPurpose from "@/models/PaymentPurpose";
import Flat from "@/models/Flat";
import { purposeAmountPerFlat, serializePayment, serializePurpose } from "@/lib/payment-utils";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

export type CollectionStatusFilter = "all" | "paid" | "pending";

/** Total flats in the society (all documents in flats). */
export async function countTotalFlats(): Promise<number> {
  return Flat.countDocuments({});
}

/** Flats that can pay: sold + non-empty owner name. */
export async function countPayableFlats(): Promise<number> {
  return Flat.countDocuments({
    status: { $in: ["sold", "rent"] },
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
 * Per-purpose progress for the summary line.
 * total = all flats in society
 * collected = distinct paid flats for the purpose
 * pending = total − collected
 * pendingAmount = pending × amountPerFlat
 */
export async function getPurposeProgressStats(
  purposes: Array<{ id: string; amount: number }>
): Promise<PurposeProgressStat[]> {
  if (purposes.length === 0) return [];

  const totalFlats = await countTotalFlats();
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
    const collected = stats.paidFlats;
    const pending = Math.max(0, totalFlats - collected);
    const collectionPercent =
      totalFlats > 0 ? Math.round((collected / totalFlats) * 100) : 0;
    return {
      purposeId: p.id,
      total: totalFlats,
      collected,
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

  // One payment per flat (ignore duplicates)
  const paidByFlat = new Map<string, (typeof paymentDocs)[number]>();
  for (const pay of paymentDocs) {
    const key = String(pay.flatNumber);
    if (!paidByFlat.has(key)) paidByFlat.set(key, pay);
  }

  const paid: PurposeDetailsResult["paid"] = [];
  const pending: PurposeDetailsResult["pending"] = [];
  let totalCollected = 0;
  let soldFlats = 0;
  let paidSoldFlats = 0;
  let unpaidSoldWithOwner = 0;
  const amountPerFlat = purposeAmountPerFlat(purpose as { amountPerFlat?: number; amount?: number });

  for (const amount of paidByFlat.values()) {
    totalCollected += Number(amount.amount) || 0;
  }

  for (const flat of allFlats) {
    const flatNumber = String(flat.flatNumber);
    const payment = paidByFlat.get(flatNumber);
    const ownerName = (flat.ownerName || "").trim();
    const ownerMobile = flat.ownerMobile || "";
    const hasOwner = !!ownerName;
    // Sold + On Rent count as sold for society dues
    const isSold = flat.status === "sold" || flat.status === "rent";

    if (isSold) soldFlats += 1;

    if (payment) {
      const serialized = serializePayment(payment as never);
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
      if (isSold) paidSoldFlats += 1;
      continue;
    }

    // Pending list + pending amount: Sold (with owner) and unpaid only
    if (!isSold || !hasOwner) continue;

    unpaidSoldWithOwner += 1;
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

  const totalFlats = allFlats.length;
  // Pending count = Total flats − Paid sold flats (includes available / unpaid)
  const pendingFlats = Math.max(0, totalFlats - paidSoldFlats);
  const collectionPercent =
    soldFlats > 0 ? Math.round((paidSoldFlats / soldFlats) * 100) : 0;

  return {
    purpose: serializePurpose(purpose as never),
    summary: {
      totalFlats,
      paidFlats: paidSoldFlats,
      pendingFlats,
      noOwnerFlats: 0,
      totalCollected,
      totalPending: unpaidSoldWithOwner * amountPerFlat,
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
