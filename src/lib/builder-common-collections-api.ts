import { CacheKeys, cachedQuery } from "@/lib/data-cache";
import type {
  BuilderCommonCollectionInput,
  BuilderCommonCollectionRecord,
} from "@/lib/builder-common-collection-service";

export type {
  BuilderCommonCollectionInput,
  BuilderCommonCollectionRecord,
  BuilderCollectionStatus,
} from "@/lib/builder-common-collection-service";

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function toRecord(raw: Record<string, unknown>): BuilderCommonCollectionRecord {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    month: Number(raw.month) || 1,
    year: Number(raw.year) || new Date().getFullYear(),
    expenseCategory: String(raw.expenseCategory ?? "").trim(),
    amount: Number(raw.amount) || 0,
    paymentMode: (String(raw.paymentMode || "cash").toLowerCase() ||
      "cash") as BuilderCommonCollectionRecord["paymentMode"],
    paymentDate: String(raw.paymentDate || "").slice(0, 10),
    referenceNumber: String(raw.referenceNumber || "").trim(),
    notes: String(raw.notes || "").trim(),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export const CacheKeysBuilderCommon = {
  list: (month = 0, year = 0, category = "") =>
    `builder-common-collections:m=${month}|y=${year}|c=${category}`,
};

export async function readBuilderCommonCollections(
  params: {
    month?: number;
    year?: number;
    category?: string;
    limit?: number;
    force?: boolean;
  } = {}
): Promise<BuilderCommonCollectionRecord[]> {
  const month = params.month || 0;
  const year = params.year || 0;
  const category = params.category?.trim() || "";
  return cachedQuery(
    CacheKeysBuilderCommon.list(month, year, category),
    async () => {
      const sp = new URLSearchParams();
      if (month) sp.set("month", String(month));
      if (year) sp.set("year", String(year));
      if (category) sp.set("category", category);
      if (params.limit) sp.set("limit", String(params.limit));
      const qs = sp.toString();
      const res = await fetch(
        `/api/builder-common-collections${qs ? `?${qs}` : ""}`,
        { cache: "no-store" }
      );
      const data = await parseJson(res);
      return ((data.collections as Record<string, unknown>[]) || []).map(toRecord);
    },
    { force: params.force }
  );
}

export async function createBuilderCommonCollectionClient(
  input: BuilderCommonCollectionInput
): Promise<BuilderCommonCollectionRecord> {
  const res = await fetch("/api/builder-common-collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toRecord(data.collection as Record<string, unknown>);
}

export async function updateBuilderCommonCollectionClient(
  id: string,
  input: BuilderCommonCollectionInput
): Promise<BuilderCommonCollectionRecord> {
  const res = await fetch(`/api/builder-common-collections/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toRecord(data.collection as Record<string, unknown>);
}

export async function deleteBuilderCommonCollectionClient(id: string): Promise<void> {
  const res = await fetch(`/api/builder-common-collections/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}

// Keep CacheKeys reference for tree-shaking awareness
void CacheKeys;
