import mongoose from "mongoose";
import Payment from "@/models/Payment";
import PaymentPurpose from "@/models/PaymentPurpose";
import Flat from "@/models/Flat";
import { purposeAmountPerFlat, serializePurpose, serializePayment } from "@/lib/payment-utils";
import { normalizeCollectionScope } from "@/lib/collection-scope";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

export type CollectionStatusFilter = "all" | "paid" | "pending";

/** Total flats in the society (all documents in flats). */
export async function countTotalFlats(): Promise<number> {
  return Flat.countDocuments({});
}

/** Flats that can pay for sold-only purposes: sold/rent + non-empty owner name. */
export async function countPayableFlats(): Promise<number> {
  return Flat.countDocuments({
    status: { $in: ["sold", "rent"] },
    ownerName: { $exists: true, $nin: [null, ""] },
  });
}

function isSoldCollectableFlat(flat: {
  status?: string | null;
  ownerName?: string | null;
}): boolean {
  const status = String(flat.status || "");
  const isSold = status === "sold" || status === "rent";
  const hasOwner = !!(flat.ownerName || "").trim();
  return isSold && hasOwner;
}

function isUnsoldFlat(flat: { status?: string | null }): boolean {
  return String(flat.status || "") === "available";
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
 * total / pending respect each purpose's collectionScope.
 */
export async function getPurposeProgressStats(
  purposes: Array<{ id: string; amount: number; collectionScope?: string }>
): Promise<PurposeProgressStat[]> {
  if (purposes.length === 0) return [];

  const [totalFlats, payableFlatDocs] = await Promise.all([
    countTotalFlats(),
    Flat.find({
      status: { $in: ["sold", "rent"] },
      ownerName: { $exists: true, $nin: [null, ""] },
    })
      .select("flatNumber")
      .lean(),
  ]);

  const payableFlatNumbers = new Set(payableFlatDocs.map((f) => String(f.flatNumber)));
  const soldFlatCount = payableFlatDocs.length;

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
              payments: {
                $push: {
                  flatNumber: "$flatNumber",
                  amount: "$amount",
                },
              },
            },
          },
        ]);

  const paidMap = new Map(
    paidAgg.map((row) => [
      String(row._id),
      (row.payments as Array<{ flatNumber?: string; amount?: number }>) || [],
    ])
  );

  return purposes.map((p) => {
    const scope = normalizeCollectionScope(p.collectionScope);
    const payments = paidMap.get(p.id) || [];
    // One amount per flat; sold-scope ignores payments outside payable flats
    const byFlat = new Map<string, number>();
    for (const row of payments) {
      const flatNumber = String(row.flatNumber || "");
      if (!flatNumber) continue;
      if (scope !== "all" && !payableFlatNumbers.has(flatNumber)) continue;
      if (!byFlat.has(flatNumber)) {
        byFlat.set(flatNumber, Number(row.amount) || 0);
      }
    }
    const collected = byFlat.size;
    const collectedAmount = [...byFlat.values()].reduce((s, n) => s + n, 0);
    const total = scope === "all" ? totalFlats : soldFlatCount;
    const pending = Math.max(0, total - collected);
    const collectionPercent = total > 0 ? Math.round((collected / total) * 100) : 0;
    return {
      purposeId: p.id,
      total,
      collected,
      pending,
      pendingAmount: pending * (p.amount || 0),
      collectedAmount,
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
    paymentSource: "owner" | "builder";
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
    /** available = unsold (builder); sold/rent = owner-collectable */
    flatStatus?: string;
  }>;
  /** Unsold flats still unpaid for this purpose (builder collection). */
  unsoldPending: Array<{
    flatId: string;
    flatNumber: string;
    floorNumber: number;
    pendingAmount: number;
  }>;
}

/** Paid / pending breakdown for one purpose (round), scoped by collectionScope. */
export async function getPurposeDetails(purposeId: string): Promise<PurposeDetailsResult | null> {
  if (!mongoose.Types.ObjectId.isValid(purposeId)) return null;

  const purpose = await PaymentPurpose.findById(purposeId).lean();
  if (!purpose) return null;

  const scope = normalizeCollectionScope(
    (purpose as { collectionScope?: string }).collectionScope
  );
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
  const unsoldPending: PurposeDetailsResult["unsoldPending"] = [];
  let totalCollected = 0;
  const amountPerFlat = purposeAmountPerFlat(purpose as { amountPerFlat?: number; amount?: number });

  const applicableFlats = allFlats.filter((flat) => {
    if (scope === "all") return true;
    return isSoldCollectableFlat(flat);
  });

  for (const flat of applicableFlats) {
    const flatNumber = String(flat.flatNumber);
    const payment = paidByFlat.get(flatNumber);
    const ownerName = (flat.ownerName || "").trim();
    const ownerMobile = flat.ownerMobile || "";
    const hasOwner = !!ownerName;
    const isUnsold = isUnsoldFlat(flat);

    if (payment) {
      const serialized = serializePayment(payment as never);
      const rawSource = String(
        (payment as { paymentSource?: string | null }).paymentSource || ""
      ).toLowerCase();
      const isBuilder = rawSource === "builder" || (isUnsold && rawSource !== "owner");
      const displayName = isBuilder
        ? "Builder"
        : (serialized.ownerName || ownerName).trim() || ownerName;
      totalCollected += Number(serialized.amount) || 0;
      paid.push({
        flatId: flat._id.toString(),
        flatNumber,
        floorNumber: flat.floorNumber,
        ownerName: isBuilder
          ? String(serialized.ownerName || "").trim() || "Builder"
          : displayName,
        ownerMobile,
        hasOwner: isBuilder || !!displayName,
        amount: serialized.amount,
        paymentDate: serialized.paymentDate,
        paymentMode: serialized.paymentMode,
        paymentId: serialized.id,
        paymentSource: isBuilder ? "builder" : "owner",
        whatsappSent: serialized.whatsappSent,
        notes: serialized.notes || "",
      });
      continue;
    }

    if (isUnsold) {
      // Only when scope = all
      unsoldPending.push({
        flatId: flat._id.toString(),
        flatNumber,
        floorNumber: flat.floorNumber,
        pendingAmount: amountPerFlat,
      });
      pending.push({
        flatId: flat._id.toString(),
        flatNumber,
        floorNumber: flat.floorNumber,
        ownerName: "",
        ownerMobile: "",
        hasOwner: false,
        pendingAmount: amountPerFlat,
        flatStatus: "available",
      });
      continue;
    }

    pending.push({
      flatId: flat._id.toString(),
      flatNumber,
      floorNumber: flat.floorNumber,
      ownerName,
      ownerMobile,
      hasOwner: true,
      pendingAmount: amountPerFlat,
      flatStatus: flat.status,
    });
  }

  const totalFlats = applicableFlats.length;
  const paidFlats = paid.length;
  const pendingFlats = Math.max(0, totalFlats - paidFlats);
  const totalCollectionTarget = totalFlats * amountPerFlat;
  const totalPending = Math.max(0, totalCollectionTarget - totalCollected);
  const collectionPercent =
    totalCollectionTarget > 0
      ? Math.round((totalCollected / totalCollectionTarget) * 100)
      : 0;

  return {
    purpose: serializePurpose(purpose as never),
    summary: {
      totalFlats,
      paidFlats,
      pendingFlats,
      noOwnerFlats: 0,
      totalCollected,
      totalPending,
      collectionPercent,
    },
    paid,
    pending,
    unsoldPending,
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

export interface BuilderPaymentInput {
  paymentPurposeId: string;
  builderName: string;
  amount: number;
  paymentMode: DbPaymentMode;
  paymentDate: Date;
  notes?: string;
  createdBy?: string | null;
}

export interface BuilderPaymentResult {
  builderPaymentId: string;
  flatCount: number;
  amountPerFlat: number;
  totalAmount: number;
  paymentsCreated: number;
  flatNumbers: string[];
}

/**
 * Record one builder batch payment and distribute per-flat paid rows
 * across every unpaid Unsold (available) flat for the purpose.
 * Uses a MongoDB transaction when supported; falls back to ordered inserts.
 */
export async function createBuilderPaymentDistribution(
  input: BuilderPaymentInput
): Promise<
  | { ok: true; data: BuilderPaymentResult }
  | { ok: false; message: string; status: number }
> {
  const purposeId = String(input.paymentPurposeId || "").trim();
  const builderName = String(input.builderName || "").trim();
  const amount = Number(input.amount);
  const paymentMode = input.paymentMode;
  const paymentDate = input.paymentDate;
  const notes = String(input.notes || "").trim();

  if (!mongoose.Types.ObjectId.isValid(purposeId)) {
    return { ok: false, message: "Invalid purpose id", status: 400 };
  }
  if (!builderName) {
    return { ok: false, message: "Builder Name is required", status: 400 };
  }
  if (!PAYMENT_MODES.includes(paymentMode)) {
    return { ok: false, message: "Payment Mode must be cash, bank, upi or cheque", status: 400 };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0", status: 400 };
  }
  if (Number.isNaN(paymentDate.getTime())) {
    return { ok: false, message: "Payment Date is invalid", status: 400 };
  }

  const purpose = await PaymentPurpose.findById(purposeId);
  if (!purpose) {
    return { ok: false, message: "Purpose not found", status: 404 };
  }

  const scope = normalizeCollectionScope(
    (purpose as { collectionScope?: string }).collectionScope
  );
  if (scope !== "all") {
    return {
      ok: false,
      message: "This purpose applies to Sold Flats Only. Builder/Unsold collection is not allowed.",
      status: 400,
    };
  }

  const amountPerFlat = purposeAmountPerFlat(
    purpose as { amountPerFlat?: number; amount?: number }
  );
  if (amountPerFlat <= 0) {
    return { ok: false, message: "Purpose amount per flat is invalid", status: 400 };
  }

  const BuilderPayment = (await import("@/models/BuilderPayment")).default;

  const [unsoldFlats, existingPayments, existingBuilderBatch, existingBuilderPayCount] =
    await Promise.all([
      Flat.find({ status: "available" }).sort({ floorNumber: 1, flatNumber: 1 }).lean(),
      Payment.find({ paymentPurposeId: purpose._id }).select("flatNumber").lean(),
      BuilderPayment.findOne({ paymentPurposeId: purpose._id }).select("_id").lean(),
      Payment.countDocuments({ paymentPurposeId: purpose._id, paymentSource: "builder" }),
    ]);

  if (existingBuilderBatch || existingBuilderPayCount > 0) {
    return {
      ok: false,
      message: "Builder payment already exists for this purpose.",
      status: 409,
    };
  }

  const paidSet = new Set(existingPayments.map((p) => String(p.flatNumber)));
  const unpaidUnsold = unsoldFlats.filter((f) => !paidSet.has(String(f.flatNumber)));

  if (unpaidUnsold.length === 0) {
    return {
      ok: false,
      message: "No unpaid unsold flats found for this purpose.",
      status: 409,
    };
  }

  const expectedTotal = unpaidUnsold.length * amountPerFlat;
  if (Math.round(amount) !== Math.round(expectedTotal)) {
    return {
      ok: false,
      message: `Amount must equal ${expectedTotal} (${unpaidUnsold.length} unsold flats × ${amountPerFlat})`,
      status: 400,
    };
  }

  const flatNumbers = unpaidUnsold.map((f) => String(f.flatNumber));
  const createdBy =
    input.createdBy && mongoose.Types.ObjectId.isValid(input.createdBy)
      ? new mongoose.Types.ObjectId(input.createdBy)
      : null;

  const paymentDocs = unpaidUnsold.map((flat) => ({
    flatId: flat._id,
    floorNumber: flat.floorNumber,
    flatNumber: String(flat.flatNumber),
    ownerName: builderName,
    paymentPurposeId: purpose._id,
    paymentPurpose: purpose.title,
    amount: amountPerFlat,
    paymentMode,
    paymentDate,
    paymentSource: "builder" as const,
    whatsappSent: false,
    notes,
    createdBy,
  }));

  const builderDoc = {
    paymentPurposeId: purpose._id,
    paymentPurpose: purpose.title,
    builderName,
    amount: expectedTotal,
    amountPerFlat,
    flatCount: unpaidUnsold.length,
    flatNumbers,
    paymentMode,
    paymentDate,
    notes,
    createdBy,
  };

  async function runInTransaction() {
    const session = await mongoose.startSession();
    try {
      let builderPaymentId = "";
      await session.withTransaction(async () => {
        const [createdBatch] = await BuilderPayment.create([builderDoc], { session });
        builderPaymentId = createdBatch._id.toString();
        await Payment.insertMany(paymentDocs, { session, ordered: true });
      });
      return builderPaymentId;
    } finally {
      session.endSession();
    }
  }

  async function runWithoutTransaction() {
    const createdBatch = await BuilderPayment.create(builderDoc);
    try {
      await Payment.insertMany(paymentDocs, { ordered: true });
    } catch (err) {
      // Roll back batch record if per-flat inserts fail (e.g. duplicate)
      await BuilderPayment.findByIdAndDelete(createdBatch._id).catch(() => undefined);
      throw err;
    }
    return createdBatch._id.toString();
  }

  try {
    let builderPaymentId: string;
    try {
      builderPaymentId = await runInTransaction();
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      // Standalone MongoDB / no replica set — fall back
      if (/transaction|replica set|not supported/i.test(msg)) {
        builderPaymentId = await runWithoutTransaction();
      } else {
        throw txErr;
      }
    }

    return {
      ok: true,
      data: {
        builderPaymentId,
        flatCount: unpaidUnsold.length,
        amountPerFlat,
        totalAmount: expectedTotal,
        paymentsCreated: unpaidUnsold.length,
        flatNumbers,
      },
    };
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? Number((err as { code: number }).code) : 0;
    if (code === 11000) {
      return {
        ok: false,
        message: "Builder payment already exists for this purpose.",
        status: 409,
      };
    }
    throw err;
  }
}
