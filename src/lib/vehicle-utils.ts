import type { DbVehicleOwnerType, DbVehicleType } from "@/models/Vehicle";
import { VEHICLE_OWNER_TYPES, VEHICLE_TYPES } from "@/models/Vehicle";

export function serializeVehicle(doc: {
  _id: { toString(): string };
  floorNumber: number;
  flatNumber: string;
  flatId?: { toString(): string } | null;
  vehicleOwnerType?: DbVehicleOwnerType | null;
  ownerName?: string | null;
  /** @deprecated legacy */
  ownerNameGujarati?: string | null;
  ownerMobile?: string | null;
  vehicleType: DbVehicleType;
  vehicleNumber?: string | null;
  stickerIssued?: boolean | null;
  stickerNumber?: string | null;
  color?: string | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const ownerName =
    String(doc.ownerName || "").trim() || String(doc.ownerNameGujarati || "").trim();

  return {
    id: doc._id.toString(),
    floorNumber: doc.floorNumber,
    flatNumber: doc.flatNumber,
    flatId: doc.flatId ? doc.flatId.toString() : null,
    vehicleOwnerType: (String(doc.vehicleOwnerType ?? "owner").toLowerCase() === "renter"
      ? "renter"
      : "owner") as DbVehicleOwnerType,
    ownerName,
    ownerMobile: doc.ownerMobile || "",
    vehicleType: doc.vehicleType,
    vehicleNumber: doc.vehicleNumber || "",
    stickerIssued: !!doc.stickerIssued,
    stickerNumber: doc.stickerNumber || "",
    color: doc.color || "",
    brand: doc.brand || "",
    model: doc.model || "",
    notes: doc.notes || "",
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const MOBILE_RE = /^\d{10}$/;

export interface VehiclePayload {
  floorNumber: number;
  flatNumber: string;
  flatId: string | null;
  vehicleOwnerType: DbVehicleOwnerType;
  ownerName: string;
  ownerMobile: string;
  vehicleType: DbVehicleType;
  vehicleNumber: string;
  stickerIssued: boolean;
  stickerNumber: string;
  color: string;
  brand: string;
  model: string;
  notes: string;
}

type VehicleOnlyFields = Omit<
  VehiclePayload,
  "floorNumber" | "flatNumber" | "flatId" | "vehicleOwnerType" | "ownerName" | "ownerMobile"
>;

function parseOwnerFields(body: Record<string, unknown>) {
  const flatId = String(body.flatId ?? "").trim() || null;
  const flatNumber = String(body.flatNumber ?? "").trim();
  const rawFloor = Number(body.floorNumber);
  // Floor is derived from the flats registry on save; accept when provided
  const floorNumber =
    rawFloor >= 1 && rawFloor <= 13 ? rawFloor : flatId || flatNumber ? 1 : 0;
  const rawType = String(body.vehicleOwnerType ?? body.ownerType ?? "owner")
    .trim()
    .toLowerCase();
  const vehicleOwnerType = (
    VEHICLE_OWNER_TYPES.includes(rawType as DbVehicleOwnerType) ? rawType : "owner"
  ) as DbVehicleOwnerType;
  // Contact name/mobile are overwritten from the flats collection on the server
  const ownerName =
    String(body.ownerName ?? "").trim() || String(body.ownerNameGujarati ?? "").trim();
  const ownerMobile = String(body.ownerMobile ?? body.mobile ?? "").trim();

  if (!flatId && !flatNumber) {
    return { ok: false as const, message: "Flat Number is required" };
  }
  if (!flatId && (!floorNumber || floorNumber < 1 || floorNumber > 13)) {
    return { ok: false as const, message: "Floor Number is required (1–13)" };
  }
  if (ownerMobile && !MOBILE_RE.test(ownerMobile)) {
    return {
      ok: false as const,
      message:
        vehicleOwnerType === "renter"
          ? "Renter Mobile must be exactly 10 digits"
          : "Owner Mobile must be exactly 10 digits",
    };
  }

  return {
    ok: true as const,
    data: {
      floorNumber: floorNumber || 1,
      flatNumber,
      flatId,
      vehicleOwnerType,
      ownerName,
      ownerMobile,
    },
  };
}

function parseVehicleOnly(
  body: Record<string, unknown>,
  index?: number
): { ok: true; data: VehicleOnlyFields } | { ok: false; message: string } {
  const prefix = index != null ? `Vehicle ${index + 1}: ` : "";
  const vehicleType = String(body.vehicleType ?? "").trim() as DbVehicleType;
  const vehicleNumber = String(body.vehicleNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const stickerIssued =
    body.stickerIssued === true || body.stickerIssued === "true" || body.stickerIssued === "yes";
  const notes = String(body.notes ?? "").trim();

  if (!VEHICLE_TYPES.includes(vehicleType)) {
    return { ok: false, message: `${prefix}Vehicle Type is required` };
  }
  if (!vehicleNumber) {
    return { ok: false, message: `${prefix}Vehicle Number is required` };
  }

  return {
    ok: true,
    data: {
      vehicleType,
      vehicleNumber,
      stickerIssued,
      stickerNumber: "",
      color: "",
      brand: "",
      model: "",
      notes,
    },
  };
}

export function validateVehiclePayload(
  body: Record<string, unknown>
): { ok: true; data: VehiclePayload } | { ok: false; message: string } {
  const owner = parseOwnerFields(body);
  if (!owner.ok) return owner;

  const vehicle = parseVehicleOnly(body);
  if (!vehicle.ok) return vehicle;

  return {
    ok: true,
    data: { ...owner.data, ...vehicle.data },
  };
}

/** Validate one contact + one or more vehicles (bulk add). */
export function validateBulkVehiclePayload(
  body: Record<string, unknown>
): { ok: true; data: VehiclePayload[] } | { ok: false; message: string } {
  const owner = parseOwnerFields(body);
  if (!owner.ok) return owner;

  const rawList = Array.isArray(body.vehicles) ? body.vehicles : null;
  if (!rawList || rawList.length === 0) {
    const single = validateVehiclePayload(body);
    if (!single.ok) return single;
    return { ok: true, data: [single.data] };
  }

  const items: VehiclePayload[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== "object") {
      return { ok: false, message: `Vehicle ${i + 1}: invalid data` };
    }
    const vehicle = parseVehicleOnly(item as Record<string, unknown>, i);
    if (!vehicle.ok) return vehicle;

    if (seen.has(vehicle.data.vehicleNumber)) {
      return {
        ok: false,
        message: `Duplicate Vehicle Number in form: ${vehicle.data.vehicleNumber}`,
      };
    }
    seen.add(vehicle.data.vehicleNumber);
    items.push({ ...owner.data, ...vehicle.data });
  }

  return { ok: true, data: items };
}

export function computeVehicleSummary(
  vehicles: Array<{ vehicleType: string; stickerIssued?: boolean }>
) {
  const total = vehicles.length;
  const cars = vehicles.filter((v) => v.vehicleType === "car").length;
  const bikes = vehicles.filter((v) => v.vehicleType === "bike").length;
  const autos = vehicles.filter((v) => v.vehicleType === "auto").length;
  const twoWheel = bikes;
  const noSticker = vehicles.filter((v) => !v.stickerIssued).length;
  return { total, cars, bikes, autos, twoWheel, noSticker };
}

/** Sort order: Car → Bike → Auto, then flat number ascending. */
export function vehicleTypeSortRank(type: string): number {
  const t = String(type || "").toLowerCase();
  if (t === "car") return 0;
  if (t === "bike") return 1;
  if (t === "auto") return 2;
  return 3;
}

export function compareVehiclesByTypeThenFlat(
  a: { vehicleType: string; flatNumber: string },
  b: { vehicleType: string; flatNumber: string }
) {
  return (
    vehicleTypeSortRank(a.vehicleType) - vehicleTypeSortRank(b.vehicleType) ||
    Number(a.flatNumber) - Number(b.flatNumber) ||
    String(a.flatNumber).localeCompare(String(b.flatNumber))
  );
}

/** Flat-number-wise list: flat ascending, then type (Car → Bike → Auto). */
export function compareVehiclesByFlatThenType(
  a: { vehicleType: string; flatNumber: string; vehicleNumber?: string },
  b: { vehicleType: string; flatNumber: string; vehicleNumber?: string }
) {
  return (
    Number(a.flatNumber) - Number(b.flatNumber) ||
    String(a.flatNumber).localeCompare(String(b.flatNumber)) ||
    vehicleTypeSortRank(a.vehicleType) - vehicleTypeSortRank(b.vehicleType) ||
    String(a.vehicleNumber || "").localeCompare(String(b.vehicleNumber || ""))
  );
}

/** Group cards: flat number ascending, owner before renter on same flat. */
export function compareVehicleGroupsByFlat(
  a: { flatNumber: string; floorNumber?: number; vehicleOwnerType?: string },
  b: { flatNumber: string; floorNumber?: number; vehicleOwnerType?: string }
) {
  return (
    Number(a.flatNumber) - Number(b.flatNumber) ||
    String(a.flatNumber).localeCompare(String(b.flatNumber)) ||
    (Number(a.floorNumber) || 0) - (Number(b.floorNumber) || 0) ||
    String(a.vehicleOwnerType || "owner").localeCompare(String(b.vehicleOwnerType || "owner"))
  );
}
