import { COMMON_EXPENSE_TOTAL_FLATS } from "@/lib/common-expense-constants";
import { CacheKeys, cachedQuery } from "@/lib/data-cache";
import type { BuilderCollectionStatus } from "@/lib/builder-common-collection-service";

export { COMMON_EXPENSE_TOTAL_FLATS };

export interface CommonExpenseCategoryShare {
  category: string;
  expenseTotal: number;
  builderShare: number;
  collected: number;
  pending: number;
}

export interface CommonExpenseItemLine {
  category: string;
  title: string;
  titleGujarati: string;
  amount: number;
}

export interface CommonExpenseSplitStats {
  month: number;
  year: number;
  totalCommonExpense: number;
  totalFlats: number;
  perFlatShare: number;
  expenseCount: number;
  soldFlats: number;
  unsoldFlats: number;
  memberShare: number;
  builderShare: number;
  builderCollected: number;
  builderPending: number;
  builderStatus: BuilderCollectionStatus;
  categories: CommonExpenseCategoryShare[];
  expenseItems: CommonExpenseItemLine[];
  years: number[];
  includedCategories: string[];
  excludedCategories: string[];
}

export function emptyCommonExpenseSplit(
  month = new Date().getMonth() + 1,
  year = new Date().getFullYear()
): CommonExpenseSplitStats {
  return {
    month,
    year,
    totalCommonExpense: 0,
    totalFlats: COMMON_EXPENSE_TOTAL_FLATS,
    perFlatShare: 0,
    expenseCount: 0,
    soldFlats: 0,
    unsoldFlats: 0,
    memberShare: 0,
    builderShare: 0,
    builderCollected: 0,
    builderPending: 0,
    builderStatus: "pending",
    categories: [],
    expenseItems: [],
    years: [year],
    includedCategories: [],
    excludedCategories: [],
  };
}

/** Remaining Builder Pending for Add Collection autofill (falls back to share if nothing collected). */
export function builderAutofillAmount(data: Pick<
  CommonExpenseSplitStats,
  "builderShare" | "builderCollected" | "builderPending"
>): number {
  const share = Math.round(Number(data.builderShare) || 0);
  const collected = Math.round(Number(data.builderCollected) || 0);
  const pendingRaw = Number(data.builderPending);
  const pending = Number.isFinite(pendingRaw)
    ? Math.max(0, Math.round(pendingRaw))
    : Math.max(0, share - collected);
  if (pending > 0) return pending;
  if (collected <= 0 && share > 0) return share;
  return 0;
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function mapCategories(raw: unknown): CommonExpenseCategoryShare[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      category: String(r.category || "").trim(),
      expenseTotal: Math.max(0, Number(r.expenseTotal) || 0),
      builderShare: Math.max(0, Number(r.builderShare) || 0),
      collected: Math.max(0, Number(r.collected) || 0),
      pending: Math.max(0, Number(r.pending) || 0),
    };
  }).filter((c) => c.category);
}

function mapExpenseItems(raw: unknown): CommonExpenseItemLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        category: String(r.category || "").trim(),
        title: String(r.title || "").trim(),
        titleGujarati: String(r.titleGujarati || "").trim(),
        amount: Math.max(0, Number(r.amount) || 0),
      };
    })
    .filter((c) => c.category);
}

export async function readCommonExpenseSplit(
  month: number,
  year: number,
  opts?: { force?: boolean }
): Promise<CommonExpenseSplitStats> {
  return cachedQuery(
    CacheKeys.commonExpenseSplit(month, year),
    async () => {
      const sp = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      const res = await fetch(`/api/dashboard/common-expense-split?${sp.toString()}`, {
        cache: "no-store",
      });
      const data = await parseJson(res);
      const totalCommonExpense = Math.max(0, Number(data.totalCommonExpense) || 0);
      const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
      const perFlatShare = Math.max(0, Number(data.perFlatShare) || 0);
      const soldFlats = Math.max(0, Number(data.soldFlats) || 0);
      const unsoldFlats = Math.max(0, Number(data.unsoldFlats) || 0);
      const builderShare = Math.max(
        0,
        Number(data.builderShare) || perFlatShare * unsoldFlats
      );
      const builderCollected = Math.max(0, Number(data.builderCollected) || 0);
      const pendingRaw = Number(data.builderPending);
      const builderPending = Number.isFinite(pendingRaw)
        ? Math.max(0, pendingRaw)
        : Math.max(0, builderShare - builderCollected);
      const statusRaw = String(data.builderStatus || "pending");
      const builderStatus: BuilderCollectionStatus =
        statusRaw === "fully_paid" || statusRaw === "partially_paid"
          ? statusRaw
          : "pending";

      return {
        month: Number(data.month) || month,
        year: Number(data.year) || year,
        totalCommonExpense: Number.isFinite(totalCommonExpense) ? totalCommonExpense : 0,
        totalFlats,
        perFlatShare: Number.isFinite(perFlatShare) ? perFlatShare : 0,
        expenseCount: Math.max(0, Number(data.expenseCount) || 0),
        soldFlats,
        unsoldFlats,
        memberShare: Math.max(
          0,
          Number(data.memberShare) || perFlatShare * soldFlats
        ),
        builderShare,
        builderCollected,
        builderPending,
        builderStatus,
        categories: mapCategories(data.categories),
        expenseItems: mapExpenseItems(data.expenseItems),
        years: Array.isArray(data.years)
          ? (data.years as number[])
              .map((y) => Number(y))
              .filter((y) => Number.isFinite(y))
          : [year],
        includedCategories: Array.isArray(data.includedCategories)
          ? (data.includedCategories as unknown[])
              .map((c) => String(c || "").trim())
              .filter(Boolean)
          : [],
        excludedCategories: Array.isArray(data.excludedCategories)
          ? (data.excludedCategories as unknown[])
              .map((c) => String(c || "").trim())
              .filter(Boolean)
          : [],
      };
    },
    { force: opts?.force }
  );
}
