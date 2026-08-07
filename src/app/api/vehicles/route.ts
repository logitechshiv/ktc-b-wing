import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vehicle, { VEHICLE_TYPES, type DbVehicleType } from "@/models/Vehicle";
import Flat from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  computeVehicleSummary,
  compareVehiclesByTypeThenFlat,
  serializeVehicle,
  validateBulkVehiclePayload,
  vehicleTypeSortRank,
} from "@/lib/vehicle-utils";

export const runtime = "nodejs";

/**
 * GET /api/vehicles
 * Query: q, sticker=yes|no, type=car|bike|...
 * Public — guests can view.
 *
 * Card contact details are resolved from the flats registry using vehicleOwnerType:
 * - owner  → flat owner name/mobile
 * - renter → flat renter name/mobile
 */
export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const sticker = (searchParams.get("sticker") || "").trim().toLowerCase();
    const type = (searchParams.get("type") || "").trim().toLowerCase();

    const filter: Record<string, unknown> = {};

    if (sticker === "yes") filter.stickerIssued = true;
    if (sticker === "no") filter.stickerIssued = false;
    if (type && VEHICLE_TYPES.includes(type as DbVehicleType)) {
      filter.vehicleType = type;
    }

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const qClean = q.replace(/\s/g, "");
      filter.$or = [
        { vehicleNumber: regex },
        { flatNumber: regex },
        { ownerName: regex },
        { ownerMobile: regex },
        { brand: regex },
        { model: regex },
        ...(qClean
          ? [{ vehicleNumber: new RegExp(qClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }]
          : []),
      ];
    }

    const [docs, allForSummary, flats] = await Promise.all([
      Vehicle.find(filter)
        .sort({ vehicleType: 1, flatNumber: 1, vehicleNumber: 1 })
        .lean(),
      Vehicle.find({}).select("vehicleType stickerIssued").lean(),
      Flat.find({}).select("flatNumber ownerName ownerMobile renterName renterMobile").lean(),
    ]);

    const flatByNumber = new Map(
      flats.map((f) => [
        String(f.flatNumber),
        {
          ownerName: f.ownerName || "",
          ownerMobile: f.ownerMobile || "",
          renterName: f.renterName || "",
          renterMobile: f.renterMobile || "",
        },
      ])
    );

    const vehicles = docs
      .map((d) => {
      const rawType = String((d as { vehicleOwnerType?: string }).vehicleOwnerType ?? "owner")
        .trim()
        .toLowerCase();
      const belongs = rawType === "renter" ? ("renter" as const) : ("owner" as const);
      const base = {
        ...serializeVehicle(d as never),
        vehicleOwnerType: belongs,
      };
      const flat = flatByNumber.get(base.flatNumber);

      if (flat) {
        if (belongs === "renter") {
          return {
            ...base,
            vehicleOwnerType: "renter" as const,
            ownerName: flat.renterName || base.ownerName,
            ownerMobile: flat.renterMobile || base.ownerMobile,
          };
        }
        return {
          ...base,
          vehicleOwnerType: "owner" as const,
          ownerName: flat.ownerName || base.ownerName,
          ownerMobile: flat.ownerMobile || base.ownerMobile,
        };
      }

      return base;
    })
      .sort(compareVehiclesByTypeThenFlat);

    const summary = computeVehicleSummary(
      allForSummary as Array<{ vehicleType: string; stickerIssued?: boolean }>
    );

    const map = new Map<
      string,
      {
        key: string;
        floorNumber: number;
        flatNumber: string;
        vehicleOwnerType: "owner" | "renter";
        ownerName: string;
        ownerMobile: string;
        vehicles: typeof vehicles;
      }
    >();

    for (const v of vehicles) {
      const belongs = v.vehicleOwnerType === "renter" ? "renter" : "owner";
      const key = `${v.floorNumber}-${v.flatNumber}-${belongs}`;
      const group = map.get(key) ?? {
        key,
        floorNumber: v.floorNumber,
        flatNumber: v.flatNumber,
        vehicleOwnerType: belongs,
        ownerName: v.ownerName,
        ownerMobile: v.ownerMobile,
        vehicles: [],
      };
      if (!group.ownerName && v.ownerName) group.ownerName = v.ownerName;
      if (!group.ownerMobile && v.ownerMobile) group.ownerMobile = v.ownerMobile;
      group.vehicles.push(v);
      map.set(key, group);
    }

    for (const group of map.values()) {
      group.vehicles.sort(compareVehiclesByTypeThenFlat);
    }

    const groups = Array.from(map.values()).sort((a, b) => {
      const aRank = Math.min(...a.vehicles.map((v) => vehicleTypeSortRank(v.vehicleType)));
      const bRank = Math.min(...b.vehicles.map((v) => vehicleTypeSortRank(v.vehicleType)));
      return (
        aRank - bRank ||
        Number(a.flatNumber) - Number(b.flatNumber) ||
        a.flatNumber.localeCompare(b.flatNumber) ||
        a.vehicleOwnerType.localeCompare(b.vehicleOwnerType)
      );
    });

    return NextResponse.json({
      success: true,
      total: vehicles.length,
      summary,
      vehicles,
      groups,
    });
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load vehicles",
      },
      { status: 500 }
    );
  }
}

/** POST /api/vehicles — Super Admin only. Supports single or bulk (`vehicles` array). */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validateBulkVehiclePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const payloads = validated.data;
    const first = payloads[0];

    // Flats are the single source of truth for contact details
    const flat = first.flatId
      ? await Flat.findById(first.flatId).lean()
      : await Flat.findOne({ flatNumber: first.flatNumber }).lean();

    if (!flat) {
      return NextResponse.json(
        { success: false, message: "Selected flat was not found" },
        { status: 400 }
      );
    }

    const flatOwnerName = String(flat.ownerName || "").trim();
    if (!flatOwnerName) {
      return NextResponse.json(
        { success: false, message: "કોઈ માલિક નથી — cannot add a vehicle to this flat" },
        { status: 400 }
      );
    }

    const wantsRenter = first.vehicleOwnerType === "renter";
    const flatRenterName = String(flat.renterName || "").trim();
    if (wantsRenter && !flatRenterName && !String(flat.renterMobile || "").trim()) {
      return NextResponse.json(
        { success: false, message: "No renter is available for this flat" },
        { status: 400 }
      );
    }

    const contactName = wantsRenter ? flatRenterName : flatOwnerName;
    const contactMobile = wantsRenter
      ? String(flat.renterMobile || "").trim()
      : String(flat.ownerMobile || "").trim();

    const numbers = payloads.map((p) => p.vehicleNumber).filter(Boolean);
    if (numbers.length > 0) {
      const existing = await Vehicle.find({ vehicleNumber: { $in: numbers } }).select("vehicleNumber");
      if (existing.length > 0) {
        const dupes = existing.map((e) => e.vehicleNumber).join(", ");
        return NextResponse.json(
          { success: false, message: `Vehicle Number already exists: ${dupes}` },
          { status: 409 }
        );
      }
    }

    const created = await Vehicle.insertMany(
      payloads.map((p) => ({
        floorNumber: flat.floorNumber,
        flatNumber: String(flat.flatNumber),
        flatId: flat._id,
        vehicleOwnerType: wantsRenter ? "renter" : "owner",
        ownerName: contactName,
        ownerMobile: contactMobile,
        vehicleType: p.vehicleType,
        vehicleNumber: p.vehicleNumber,
        stickerIssued: p.stickerIssued,
        stickerNumber: "",
        color: "",
        brand: "",
        model: "",
        notes: p.notes,
        createdBy: gate.user.id,
      })),
      { ordered: true }
    );

    const vehicles = created.map((v) => serializeVehicle(v as never));
    return NextResponse.json(
      {
        success: true,
        message: vehicles.length === 1 ? "Vehicle added" : `${vehicles.length} vehicles added`,
        vehicles,
        vehicle: vehicles[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/vehicles error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to add vehicle",
      },
      { status: 500 }
    );
  }
}
