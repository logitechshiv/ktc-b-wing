import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export interface ImportantNumberRecord {
  id: string;
  name: string;
  description: string;
  area: string;
  phone: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ImportantNumberInput {
  name: string;
  description?: string;
  area?: string;
  phone: string;
  displayOrder?: number;
  isActive?: boolean;
}

function toRecord(raw: Record<string, unknown>): ImportantNumberRecord {
  return {
    id: String(raw.id ?? raw._id),
    name: String(raw.name ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    area: String(raw.area ?? "").trim(),
    phone: String(raw.phone ?? "").replace(/\D/g, ""),
    displayOrder: Number(raw.displayOrder) || 0,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function readImportantNumbers(
  params: { all?: boolean; force?: boolean } = {}
): Promise<ImportantNumberRecord[]> {
  const all = !!params.all;
  return cachedQuery(
    CacheKeys.importantNumbers(all),
    async () => {
      const sp = new URLSearchParams();
      if (all) sp.set("all", "1");
      const qs = sp.toString();
      const res = await fetch(`/api/important-numbers${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await parseJson(res);
      return ((data.importantNumbers as Record<string, unknown>[]) || []).map(toRecord);
    },
    { force: params.force }
  );
}

export async function createImportantNumber(
  input: ImportantNumberInput
): Promise<ImportantNumberRecord> {
  const res = await fetch("/api/important-numbers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toRecord(data.importantNumber);
}

export async function updateImportantNumber(
  id: string,
  input: ImportantNumberInput
): Promise<ImportantNumberRecord> {
  const res = await fetch(`/api/important-numbers/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toRecord(data.importantNumber);
}

export async function deleteImportantNumber(id: string): Promise<void> {
  const res = await fetch(`/api/important-numbers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}
