import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export interface Kiran3CommonBalance {
  totalCommonCredit: number;
  totalCommonDebit: number;
  balance: number;
  creditCategories: string[];
  debitCategories: string[];
  /** @deprecated alias */
  givenToCommon: number;
  /** @deprecated alias */
  commonExpense: number;
}

export function emptyKiran3CommonBalance(): Kiran3CommonBalance {
  return {
    totalCommonCredit: 0,
    totalCommonDebit: 0,
    balance: 0,
    creditCategories: [],
    debitCategories: [],
    givenToCommon: 0,
    commonExpense: 0,
  };
}

export async function readKiran3CommonBalance(opts?: {
  force?: boolean;
}): Promise<Kiran3CommonBalance> {
  return cachedQuery(
    CacheKeys.kiran3Common(),
    async () => {
      const res = await fetch("/api/dashboard/kiran3-common", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      const totalCommonCredit = Math.max(
        0,
        Number(data.totalCommonCredit ?? data.givenToCommon) || 0
      );
      const totalCommonDebit = Math.max(
        0,
        Number(data.totalCommonDebit ?? data.commonExpense) || 0
      );
      return {
        totalCommonCredit,
        totalCommonDebit,
        balance: Number.isFinite(Number(data.balance))
          ? Number(data.balance)
          : totalCommonCredit - totalCommonDebit,
        creditCategories: Array.isArray(data.creditCategories)
          ? data.creditCategories.map((n: unknown) => String(n || "").trim()).filter(Boolean)
          : [],
        debitCategories: Array.isArray(data.debitCategories)
          ? data.debitCategories.map((n: unknown) => String(n || "").trim()).filter(Boolean)
          : [],
        givenToCommon: totalCommonCredit,
        commonExpense: totalCommonDebit,
      };
    },
    { force: opts?.force }
  );
}
