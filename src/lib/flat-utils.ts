import type { FlatStatus } from "@/models/Flat";

export function serializeFlat(doc: {
  _id: { toString(): string };
  floorNumber: number;
  flatNumber: string;
  ownerName?: string | null;
  /** @deprecated legacy — preferred into ownerName during migration */
  ownerNameGujarati?: string | null;
  ownerMobile?: string | null;
  renterName?: string | null;
  /** @deprecated legacy — preferred into renterName during migration */
  renterNameGujarati?: string | null;
  renterMobile?: string | null;
  status: FlatStatus;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const ownerName =
    String(doc.ownerNameGujarati || "").trim() || String(doc.ownerName || "").trim();
  const renterName =
    String(doc.renterNameGujarati || "").trim() || String(doc.renterName || "").trim();

  return {
    id: doc._id.toString(),
    floorNumber: doc.floorNumber,
    flatNumber: doc.flatNumber,
    ownerName,
    ownerMobile: doc.ownerMobile || "",
    renterName,
    renterMobile: doc.renterMobile || "",
    status: doc.status,
    notes: doc.notes || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const MOBILE_RE = /^\d{10}$/;

export interface FlatPayload {
  floorNumber: number;
  flatNumber: string;
  ownerName: string;
  ownerMobile: string;
  renterName: string;
  renterMobile: string;
  status: FlatStatus;
  notes: string;
}

/** Shared validation for create / upsert / update payloads. */
export function validateFlatPayload(
  body: Record<string, unknown>,
  opts: { requireFloorFlat?: boolean } = { requireFloorFlat: true }
): { ok: true; data: FlatPayload } | { ok: false; message: string } {
  const floorNumber = Number(body.floorNumber);
  const flatNumber = String(body.flatNumber ?? "").trim();
  const status = String(body.status ?? "").trim() as FlatStatus;
  // Accept legacy ownerNameGujarati key if an old client still sends it
  const ownerName =
    String(body.ownerName ?? "").trim() || String(body.ownerNameGujarati ?? "").trim();
  const ownerMobile = String(body.ownerMobile ?? "").trim();
  const renterName =
    String(body.renterName ?? "").trim() || String(body.renterNameGujarati ?? "").trim();
  const renterMobile = String(body.renterMobile ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (opts.requireFloorFlat) {
    if (!floorNumber || floorNumber < 1 || floorNumber > 13) {
      return { ok: false, message: "Floor Number is required (1–13)" };
    }
    if (!flatNumber) {
      return { ok: false, message: "Flat Number is required" };
    }
  }

  if (!["available", "sold", "rent"].includes(status)) {
    return { ok: false, message: "Status is required" };
  }

  if (ownerMobile && !MOBILE_RE.test(ownerMobile)) {
    return { ok: false, message: "Owner Mobile must be exactly 10 digits" };
  }

  if (renterMobile && !MOBILE_RE.test(renterMobile)) {
    return { ok: false, message: "Renter Mobile must be exactly 10 digits" };
  }

  const hasRenterDetails = !!(renterName || renterMobile);

  let nextStatus = status;
  if (hasRenterDetails && nextStatus === "available") {
    nextStatus = "rent";
  }

  return {
    ok: true,
    data: {
      floorNumber: floorNumber || 0,
      flatNumber,
      ownerName,
      ownerMobile,
      renterName,
      renterMobile,
      status: nextStatus,
      notes,
    },
  };
}
