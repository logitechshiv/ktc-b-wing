import {
  normalizeCollectionScope,
  type CollectionScope,
} from "@/lib/collection-scope";
import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export type { CollectionScope };

export interface PurposeRecord {
  id: string;
  title: string;
  amount: number;
  amountPerFlat: number;
  description: string;
  collectionScope: CollectionScope;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurposeStat {
  purposeId: string;
  total: number;
  collected: number;
  pending: number;
  pendingAmount: number;
  collectedAmount?: number;
  collectionPercent?: number;
}

export interface PurposeInput {
  title: string;
  amount?: number;
  amountPerFlat?: number;
  description?: string;
  collectionScope?: CollectionScope;
  isActive?: boolean;
}

export interface PurposePaidFlat {
  flatId: string;
  flatNumber: string;
  floorNumber: number;
  ownerName: string;
  ownerMobile: string;
  hasOwner: boolean;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  paymentId: string;
  paymentSource?: "owner" | "builder";
  whatsappSent: boolean;
  notes?: string;
}

export interface PurposePendingFlat {
  flatId: string;
  flatNumber: string;
  floorNumber: number;
  ownerName: string;
  ownerMobile: string;
  hasOwner: boolean;
  pendingAmount: number;
  flatStatus?: string;
}

export interface PurposeUnsoldPendingFlat {
  flatId: string;
  flatNumber: string;
  floorNumber: number;
  pendingAmount: number;
}

export interface PurposeDetailsSummary {
  totalFlats: number;
  paidFlats: number;
  pendingFlats: number;
  noOwnerFlats?: number;
  totalCollected: number;
  totalPending: number;
  collectionPercent?: number;
}

export interface PurposeDetails {
  purpose: PurposeRecord;
  summary: PurposeDetailsSummary;
  paid: PurposePaidFlat[];
  pending: PurposePendingFlat[];
  unsoldPending: PurposeUnsoldPendingFlat[];
}

function toPurpose(raw: Record<string, unknown>): PurposeRecord {
  const amountPerFlat = Number(raw.amountPerFlat ?? raw.amount) || 0;
  return {
    id: String(raw.id ?? raw._id),
    title: String(raw.title ?? ""),
    amount: amountPerFlat,
    amountPerFlat,
    description: String(raw.description ?? ""),
    collectionScope: normalizeCollectionScope(raw.collectionScope),
    isActive: raw.isActive !== false,
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

export async function readPurposes(
  activeOnly = false,
  opts?: { force?: boolean }
): Promise<{
  purposes: PurposeRecord[];
  stats: PurposeStat[];
}> {
  return cachedQuery(
    CacheKeys.purposes(activeOnly),
    async () => {
      const sp = new URLSearchParams();
      if (activeOnly) sp.set("active", "true");
      const res = await fetch(`/api/payment-purposes?${sp.toString()}`, { cache: "no-store" });
      const data = await parseJson(res);
      return {
        purposes: ((data.purposes as Record<string, unknown>[]) || []).map(toPurpose),
        stats: (data.stats as PurposeStat[]) || [],
      };
    },
    { force: opts?.force }
  );
}

export async function createPurpose(input: PurposeInput): Promise<PurposeRecord> {
  const amountPerFlat = Number(input.amountPerFlat ?? input.amount) || 0;
  const res = await fetch("/api/payment-purposes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? "",
      amountPerFlat,
      collectionScope: normalizeCollectionScope(input.collectionScope),
      isActive: input.isActive !== false,
    }),
  });
  const data = await parseJson(res);
  return toPurpose(data.purpose);
}

export async function updatePurpose(id: string, input: PurposeInput): Promise<PurposeRecord> {
  const amountPerFlat = Number(input.amountPerFlat ?? input.amount) || 0;
  const res = await fetch(`/api/payment-purposes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? "",
      amountPerFlat,
      collectionScope: normalizeCollectionScope(input.collectionScope),
      isActive: input.isActive !== false,
    }),
  });
  const data = await parseJson(res);
  return toPurpose(data.purpose);
}

export async function deletePurpose(id: string): Promise<void> {
  const res = await fetch(`/api/payment-purposes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}

/** GET /api/payment-purposes/[id] — purpose + paid/pending breakdown */
export async function readPurposeDetails(
  id: string,
  opts?: { force?: boolean }
): Promise<PurposeDetails> {
  if (!id) throw new Error("Missing purpose id");
  return cachedQuery(
    CacheKeys.purposeDetails(id),
    async () => {
      const res = await fetch(`/api/payment-purposes/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await parseJson(res);

      const paid = ((data.paid as Record<string, unknown>[]) || []).map((row) => {
        const ownerName = String(row.ownerName ?? "");
        return {
          flatId: String(row.flatId ?? ""),
          flatNumber: String(row.flatNumber ?? ""),
          floorNumber: Number(row.floorNumber) || 0,
          ownerName,
          ownerMobile: String(row.ownerMobile ?? ""),
          hasOwner: typeof row.hasOwner === "boolean" ? row.hasOwner : !!ownerName.trim(),
          amount: Number(row.amount) || 0,
          paymentDate: row.paymentDate ? String(row.paymentDate).slice(0, 10) : "",
          paymentMode: String(row.paymentMode ?? ""),
          paymentId: String(row.paymentId ?? ""),
          paymentSource: row.paymentSource === "builder" ? ("builder" as const) : ("owner" as const),
          whatsappSent: !!row.whatsappSent,
          notes: String(row.notes ?? ""),
        };
      });

      const pending = ((data.pending as Record<string, unknown>[]) || []).map((row) => {
        const ownerName = String(row.ownerName ?? "");
        const hasOwner =
          typeof row.hasOwner === "boolean" ? row.hasOwner : !!ownerName.trim();
        return {
          flatId: String(row.flatId ?? ""),
          flatNumber: String(row.flatNumber ?? ""),
          floorNumber: Number(row.floorNumber) || 0,
          ownerName,
          ownerMobile: String(row.ownerMobile ?? ""),
          hasOwner,
          pendingAmount: Number(row.pendingAmount) || 0,
          flatStatus: row.flatStatus ? String(row.flatStatus) : undefined,
        };
      });

      const unsoldPending = ((data.unsoldPending as Record<string, unknown>[]) || []).map((row) => ({
        flatId: String(row.flatId ?? ""),
        flatNumber: String(row.flatNumber ?? ""),
        floorNumber: Number(row.floorNumber) || 0,
        pendingAmount: Number(row.pendingAmount) || 0,
      }));

      const summary = (data.summary as PurposeDetailsSummary) || {
        totalFlats: 0,
        paidFlats: 0,
        pendingFlats: 0,
        noOwnerFlats: 0,
        totalCollected: 0,
        totalPending: 0,
        collectionPercent: 0,
      };

      return {
        purpose: toPurpose(data.purpose as Record<string, unknown>),
        summary,
        paid,
        pending,
        unsoldPending,
      };
    },
    { force: opts?.force }
  );
}
