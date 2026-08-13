import { CacheKeys, cachedQuery } from "@/lib/data-cache";

export type VehicleType = "car" | "bike" | "auto";
export type VehicleOwnerType = "owner" | "renter";

export interface VehicleRecord {
  id: string;
  floorNumber: number;
  flatNumber: string;
  flatId?: string | null;
  vehicleOwnerType: VehicleOwnerType;
  ownerName: string;
  ownerMobile: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  stickerIssued: boolean;
  stickerNumber: string;
  color: string;
  brand: string;
  model: string;
  notes: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleSummary {
  total: number;
  cars: number;
  bikes: number;
  autos: number;
  twoWheel: number;
  noSticker: number;
}

export interface VehicleGroup {
  key: string;
  floorNumber: number;
  flatNumber: string;
  vehicleOwnerType: VehicleOwnerType;
  ownerName: string;
  ownerMobile: string;
  vehicles: VehicleRecord[];
}

export interface VehicleListResult {
  vehicles: VehicleRecord[];
  groups: VehicleGroup[];
  summary: VehicleSummary;
}

export interface VehicleEntryInput {
  vehicleType: VehicleType;
  vehicleNumber: string;
  stickerIssued?: boolean;
  stickerNumber?: string;
  color?: string;
  brand?: string;
  model?: string;
  notes?: string;
}

export interface VehicleInput extends VehicleEntryInput {
  floorNumber: number;
  flatNumber: string;
  flatId?: string | null;
  vehicleOwnerType?: VehicleOwnerType;
  ownerName?: string;
  ownerMobile?: string;
}

/** Bulk add: shared contact + multiple vehicle entries */
export interface BulkVehicleInput {
  floorNumber: number;
  flatNumber: string;
  flatId?: string | null;
  vehicleOwnerType?: VehicleOwnerType;
  ownerName?: string;
  ownerMobile?: string;
  vehicles: VehicleEntryInput[];
}

export interface VehicleListParams {
  q?: string;
  sticker?: "all" | "yes" | "no";
  type?: VehicleType | "all";
}

function toVehicle(raw: Record<string, unknown>): VehicleRecord {
  return {
    id: String(raw.id ?? raw._id),
    floorNumber: Number(raw.floorNumber),
    flatNumber: String(raw.flatNumber ?? ""),
    flatId: raw.flatId ? String(raw.flatId) : null,
    vehicleOwnerType: String(raw.vehicleOwnerType ?? "owner").toLowerCase() === "renter" ? "renter" : "owner",
    ownerName: String(raw.ownerName ?? ""),
    ownerMobile: String(raw.ownerMobile ?? ""),
    vehicleType: (["car", "bike", "auto"].includes(String(raw.vehicleType))
      ? (raw.vehicleType as VehicleType)
      : "car"),
    vehicleNumber: String(raw.vehicleNumber ?? ""),
    stickerIssued: !!raw.stickerIssued,
    stickerNumber: String(raw.stickerNumber ?? ""),
    color: String(raw.color ?? ""),
    brand: String(raw.brand ?? ""),
    model: String(raw.model ?? ""),
    notes: String(raw.notes ?? ""),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
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

/** GET /api/vehicles */
export async function readVehicles(
  params: VehicleListParams & { force?: boolean } = {}
): Promise<VehicleListResult> {
  const q = params.q?.trim() || "";
  const sticker = params.sticker || "all";
  const type = params.type || "all";
  return cachedQuery(
    CacheKeys.vehicles(q, sticker, type),
    async () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (sticker !== "all") sp.set("sticker", sticker);
      if (type !== "all") sp.set("type", type);

      const res = await fetch(`/api/vehicles?${sp.toString()}`, { cache: "no-store" });
      const data = await parseJson(res);

      return {
        vehicles: ((data.vehicles as Record<string, unknown>[]) || []).map(toVehicle),
        groups: ((data.groups as Array<Record<string, unknown>>) || []).map((g) => {
          const vehicles = ((g.vehicles as Record<string, unknown>[]) || []).map(toVehicle);
          // Prefer group field (card is keyed by owner|renter), then vehicle docs
          const rawType =
            (typeof g.vehicleOwnerType === "string" ? g.vehicleOwnerType : undefined) ??
            vehicles[0]?.vehicleOwnerType;
          const vehicleOwnerType: VehicleOwnerType =
            String(rawType ?? "owner").toLowerCase() === "renter" ? "renter" : "owner";

          return {
            key: String(g.key ?? `${g.floorNumber}-${g.flatNumber}-${vehicleOwnerType}`),
            floorNumber: Number(g.floorNumber),
            flatNumber: String(g.flatNumber ?? ""),
            vehicleOwnerType,
            ownerName: String(
              g.ownerName ||
                vehicles.find((v) => v.vehicleOwnerType === vehicleOwnerType)?.ownerName ||
                vehicles[0]?.ownerName ||
                ""
            ),
            ownerMobile: String(
              g.ownerMobile ||
                vehicles.find((v) => v.vehicleOwnerType === vehicleOwnerType)?.ownerMobile ||
                vehicles[0]?.ownerMobile ||
                ""
            ),
            vehicles,
          };
        }),
        summary: {
          total: Number((data.summary as VehicleSummary)?.total) || 0,
          cars: Number((data.summary as VehicleSummary)?.cars) || 0,
          bikes: Number((data.summary as VehicleSummary)?.bikes) || 0,
          autos: Number((data.summary as VehicleSummary)?.autos) || 0,
          twoWheel: Number((data.summary as VehicleSummary)?.twoWheel) || 0,
          noSticker: Number((data.summary as VehicleSummary)?.noSticker) || 0,
        },
      };
    },
    { force: params.force }
  );
}

/** POST /api/vehicles — single vehicle */
export async function createVehicle(input: VehicleInput): Promise<VehicleRecord> {
  const res = await fetch("/api/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toVehicle(data.vehicle);
}

/** POST /api/vehicles — multiple vehicles for one owner/flat */
export async function createVehicles(input: BulkVehicleInput): Promise<VehicleRecord[]> {
  const res = await fetch("/api/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  const list = (data.vehicles as Record<string, unknown>[]) || (data.vehicle ? [data.vehicle] : []);
  return list.map(toVehicle);
}

/** PUT /api/vehicles/[id] */
export async function updateVehicle(id: string, input: VehicleInput): Promise<VehicleRecord> {
  if (!id) throw new Error("Missing vehicle id");
  const res = await fetch(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toVehicle(data.vehicle);
}

/** DELETE /api/vehicles/[id] */
export async function deleteVehicle(id: string): Promise<void> {
  if (!id) throw new Error("Missing vehicle id");
  const res = await fetch(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}
