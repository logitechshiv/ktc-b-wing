import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export interface Kiran3CommonBalance {
  givenToCommon: number;
  commonExpense: number;
  balance: number;
  includedCategories: string[];
  societyAdvanceCategory: string;
}

export function emptyKiran3CommonBalance(): Kiran3CommonBalance {
  return {
    givenToCommon: 0,
    commonExpense: 0,
    balance: 0,
    includedCategories: [],
    societyAdvanceCategory: "KIRAN 3 Society Advance",
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
      const givenToCommon = Math.max(0, Number(data.givenToCommon) || 0);
      const commonExpense = Math.max(0, Number(data.commonExpense) || 0);
      return {
        givenToCommon,
        commonExpense,
        balance: Number.isFinite(Number(data.balance))
          ? Number(data.balance)
          : givenToCommon - commonExpense,
        includedCategories: Array.isArray(data.includedCategories)
          ? data.includedCategories.map((n: unknown) => String(n || "").trim()).filter(Boolean)
          : [],
        societyAdvanceCategory:
          String(data.societyAdvanceCategory || "").trim() || "KIRAN 3 Society Advance",
      };
    },
    { force: opts?.force }
  );
}
