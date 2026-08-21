import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import Flat from "@/models/Flat";
import Vehicle from "@/models/Vehicle";
import BuilderCommonCollection from "@/models/BuilderCommonCollection";
import { serializeExpense } from "@/lib/expense-utils";
import { normalizeCategoryName } from "@/lib/common-expense-constants";
import { getKiran3OnlyCategoryKeys } from "@/lib/expense-category-common";

export interface ExpenseByCategory {
  category: string;
  amount: number;
}

export interface PaymentModeBreakdown {
  mode: string;
  label: string;
  collected: number;
  spent: number;
}

export interface DashboardStats {
  totalBalance: number;
  totalCollection: number;
  totalExpense: number;
  cashInHand: number;
  bankBalance: number;
  flats: {
    total: number;
    sold: number;
    available: number;
  };
  vehicles: {
    fourWheelers: number;
    twoWheelers: number;
    threeWheelers: number;
  };
  expensesByCategory: ExpenseByCategory[];
  byPaymentMode: PaymentModeBreakdown[];
  recentExpenses: Array<{
    id: string;
    category: string;
    expenseTitleGujarati: string;
    amount: number;
    displayOrder: number;
    paymentMethod: string;
    expenseDate: string;
    billImage: string;
    billImages: string[];
    notes: string;
    whatsappShared: boolean;
  }>;
}

const BANK_MODES = ["bank", "upi", "cheque"] as const;

const PAYMENT_MODE_ROWS: { mode: string; label: string }[] = [
  { mode: "cash", label: "Cash" },
  { mode: "upi", label: "UPI" },
  { mode: "bank", label: "Bank Transfer" },
  { mode: "cheque", label: "Cheque" },
];

function sumByMode(
  rows: { _id: string | null; total: number }[],
  modes: readonly string[]
) {
  const set = new Set(modes);
  return rows.reduce((s, r) => (set.has(String(r._id || "").toLowerCase()) ? s + (r.total || 0) : s), 0);
}

function sumCash(rows: { _id: string | null; total: number }[]) {
  return sumByMode(rows, ["cash"]);
}

function modeTotal(
  rows: { _id: string | null; total: number }[],
  mode: string
): number {
  const key = mode.toLowerCase();
  return rows.reduce(
    (s, r) => (String(r._id || "").toLowerCase() === key ? s + (r.total || 0) : s),
    0
  );
}

/** Merge two mode-total aggregates (e.g. purpose payments + builder common collections). */
function mergeModeTotals(
  a: { _id: string | null; total: number }[],
  b: { _id: string | null; total: number }[]
): { _id: string | null; total: number }[] {
  const map = new Map<string, number>();
  for (const row of [...a, ...b]) {
    const key = String(row._id || "").toLowerCase() || "cash";
    map.set(key, (map.get(key) || 0) + (Number(row.total) || 0));
  }
  return Array.from(map.entries()).map(([_id, total]) => ({ _id, total }));
}

/**
 * Payments that count as actually received for dashboard Collected / By Payment Mode.
 * Source of truth = `payments` collection rows only (never flats × amountPerFlat).
 *
 * Aligns with Collections payable flats:
 * - collectionScope "all" → every received payment for that purpose
 * - sold-scope → payment on a sold/rent flat that has an owner and/or renter
 * Pending/unpaid flats have no payment row, so they are never included.
 */
const RECEIVED_PAYMENT_PIPELINE: PipelineStage[] = [
  {
    $lookup: {
      from: "payment_purposes",
      let: { purposeId: "$paymentPurposeId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$purposeId"] } } },
        { $project: { collectionScope: 1 } },
      ],
      as: "purpose",
    },
  },
  {
    $lookup: {
      from: "flats",
      let: { flatId: "$flatId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$flatId"] } } },
        { $project: { status: 1, ownerName: 1, renterName: 1 } },
      ],
      as: "flat",
    },
  },
  { $unwind: { path: "$purpose", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$flat", preserveNullAndEmptyArrays: true } },
  {
    $match: {
      $expr: {
        $or: [
          { $eq: [{ $ifNull: ["$purpose.collectionScope", "sold"] }, "all"] },
          {
            $and: [
              { $in: ["$flat.status", ["sold", "rent"]] },
              {
                $or: [
                  {
                    $gt: [
                      {
                        $strLenCP: {
                          $trim: { input: { $ifNull: ["$flat.ownerName", ""] } },
                        },
                      },
                      0,
                    ],
                  },
                  {
                    $gt: [
                      {
                        $strLenCP: {
                          $trim: {
                            input: { $ifNull: ["$flat.renterName", ""] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    $group: {
      _id: "$paymentMode",
      total: { $sum: "$amount" },
    },
  },
];

/**
 * Aggregated dashboard stats from payments, builder common collections, expenses, flats, vehicles.
 * Common Credit (+) / Common Debit (−) expenses are excluded from Fund Summary — they only
 * affect the separate Kiran 3 Common card.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await connectDB();

  const [
    purposePaymentAgg,
    builderCommonAgg,
    expenseByMethodAndCategory,
    expenseByCategoryRaw,
    recentExpenseDocs,
    flatAgg,
    vehicleAgg,
    kiran3CategoryKeys,
  ] = await Promise.all([
      Payment.aggregate<{ _id: string | null; total: number }>([
        ...RECEIVED_PAYMENT_PIPELINE,
      ]).exec(),
      BuilderCommonCollection.aggregate<{ _id: string | null; total: number }>([
        {
          $group: {
            _id: "$paymentMode",
            total: { $sum: "$amount" },
          },
        },
      ]).exec(),
      Expense.aggregate<{
        _id: { method: string | null; category: string | null };
        total: number;
      }>([
        {
          $group: {
            _id: {
              method: "$paymentMethod",
              category: "$category",
            },
            total: { $sum: "$amount" },
          },
        },
      ]).exec(),
      Expense.aggregate<{ _id: string | null; total: number }>([
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
          },
        },
        { $sort: { total: -1 } },
      ]).exec(),
      Expense.find({})
        .select(
          "category expenseTitleGujarati amount displayOrder paymentMethod expenseDate billImage billImages notes whatsappShared createdAt"
        )
        .sort({ createdAt: -1, expenseDate: -1 })
        .limit(3)
        .lean()
        .exec(),
      Flat.aggregate<{ _id: string | null; count: number }>([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]).exec(),
      Vehicle.aggregate<{ _id: string | null; count: number }>([
        {
          $group: {
            _id: "$vehicleType",
            count: { $sum: 1 },
          },
        },
      ]).exec(),
      getKiran3OnlyCategoryKeys(),
    ]);

  const isKiran3Only = (category: string) =>
    kiran3CategoryKeys.has(normalizeCategoryName(category));

  const methodTotals = new Map<string, number>();
  for (const row of expenseByMethodAndCategory) {
    const category = String(row._id?.category || "");
    if (isKiran3Only(category)) continue;
    const method = String(row._id?.method || "").toLowerCase() || "cash";
    methodTotals.set(method, (methodTotals.get(method) || 0) + (Number(row.total) || 0));
  }
  const expenseAgg = Array.from(methodTotals.entries()).map(([_id, total]) => ({
    _id,
    total,
  }));

  const expenseByCategoryAgg = expenseByCategoryRaw.filter(
    (r) => r._id && !isKiran3Only(String(r._id))
  );

  const paymentAgg = mergeModeTotals(purposePaymentAgg, builderCommonAgg);

  const totalCollection = paymentAgg.reduce((s, r) => s + (r.total || 0), 0);
  const totalExpense = expenseAgg.reduce((s, r) => s + (r.total || 0), 0);

  const cashCollection = sumCash(paymentAgg);
  const cashExpense = sumCash(expenseAgg);
  const bankCollection = sumByMode(paymentAgg, BANK_MODES);
  const bankExpense = sumByMode(expenseAgg, BANK_MODES);

  const cashInHand = Math.max(0, cashCollection - cashExpense);
  const bankBalance = bankCollection - bankExpense;
  const totalBalance = totalCollection - totalExpense;

  const sold = flatAgg.find((r) => r._id === "sold")?.count ?? 0;
  const available = flatAgg.find((r) => r._id === "available")?.count ?? 0;
  const flatsTotal = flatAgg.reduce((s, r) => s + (r.count || 0), 0);

  const typeCount = (types: string[]) =>
    types.reduce((s, t) => s + (vehicleAgg.find((r) => r._id === t)?.count ?? 0), 0);

  return {
    totalBalance,
    totalCollection,
    totalExpense,
    cashInHand,
    bankBalance,
    flats: {
      total: flatsTotal,
      sold,
      available,
    },
    vehicles: {
      fourWheelers: typeCount(["car"]),
      twoWheelers: typeCount(["bike", "scooter"]),
      threeWheelers: typeCount(["auto"]),
    },
    expensesByCategory: expenseByCategoryAgg
      .filter((r) => r._id)
      .map((r) => ({
        category: String(r._id),
        amount: Number(r.total) || 0,
      })),
    byPaymentMode: PAYMENT_MODE_ROWS.map((row) => ({
      mode: row.mode,
      label: row.label,
      collected: modeTotal(paymentAgg, row.mode),
      spent: modeTotal(expenseAgg, row.mode),
    })),
    recentExpenses: recentExpenseDocs.map((d) => {
      const s = serializeExpense(d as never);
      return {
        id: s.id,
        category: s.category,
        expenseTitleGujarati: s.expenseTitleGujarati,
        amount: s.amount,
        displayOrder: s.displayOrder,
        paymentMethod: s.paymentMethod,
        expenseDate: s.expenseDate
          ? new Date(s.expenseDate).toISOString().slice(0, 10)
          : "",
        billImage: s.billImage,
        billImages: s.billImages,
        notes: s.notes,
        whatsappShared: s.whatsappShared,
      };
    }),
  };
}
