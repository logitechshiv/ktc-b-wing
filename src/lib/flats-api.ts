import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export type FlatStatus = "available" | "sold" | "rent";

export interface FlatRecord {
  id: string;
  floorNumber: number;
  flatNumber: string;
  /** Owner name (Gujarati) */
  ownerName: string;
  ownerMobile: string;
  /** Renter name (Gujarati) */
  renterName: string;
  renterMobile: string;
  status: FlatStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FloorGroup {
  floorNumber: number;
  total: number;
  sold: number;
  rent: number;
  available: number;
  flats: FlatRecord[];
}

export interface FlatInput {
  floorNumber?: number;
  flatNumber?: string;
  ownerName?: string;
  ownerMobile?: string;
  renterName?: string;
  renterMobile?: string;
  status?: FlatStatus;
  notes?: string;
}

export interface FlatListParams {
  q?: string;
  status?: FlatStatus | "all";
}

function toFlat(raw: Record<string, unknown>): FlatRecord {
  return {
    id: String(raw.id ?? raw._id),
    floorNumber: Number(raw.floorNumber),
    flatNumber: String(raw.flatNumber ?? ""),
    ownerName: String(raw.ownerName ?? ""),
    ownerMobile: String(raw.ownerMobile ?? ""),
    renterName: String(raw.renterName ?? ""),
    renterMobile: String(raw.renterMobile ?? ""),
    status: (raw.status as FlatStatus) || "available",
    notes: String(raw.notes ?? ""),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

/** GET /api/flats — floors grouped, with optional search + status filter */
export async function readFlats(
  params: FlatListParams & { force?: boolean } = {}
): Promise<FloorGroup[]> {
  const q = params.q?.trim() || "";
  const status = params.status || "all";
  return cachedQuery(
    CacheKeys.flats(q, status),
    async () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (status !== "all") sp.set("status", status);

      const res = await fetch(`/api/flats?${sp.toString()}`, { cache: "no-store" });
      const data = await parseJson(res);
      return (data.floors as FloorGroup[]) ?? [];
    },
    { force: params.force }
  );
}

/** GET /api/flats/[id] */
export async function readFlat(id: string): Promise<FlatRecord> {
  const res = await fetch(`/api/flats/${id}`, { cache: "no-store" });
  const data = await parseJson(res);
  return toFlat(data.flat);
}

/** POST /api/flats — create only (rejects duplicate flat numbers) — requires Super Admin cookie */
export async function createFlat(input: FlatInput): Promise<FlatRecord> {
  const res = await fetch("/api/flats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toFlat(data.flat);
}

/** PUT /api/flats/[id] — requires Super Admin cookie */
export async function updateFlat(id: string, input: FlatInput): Promise<FlatRecord> {
  if (!id) throw new Error("Missing flat id");

  const res = await fetch(`/api/flats/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toFlat(data.flat);
}

/**
 * DELETE /api/flats/[id] — clears owner/renter details only (does not remove the flat card).
 * Requires Super Admin cookie.
 */
export async function deleteFlat(id: string): Promise<FlatRecord> {
  if (!id) throw new Error("Missing flat id");

  const res = await fetch(`/api/flats/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await parseJson(res);
  return toFlat(data.flat);
}
