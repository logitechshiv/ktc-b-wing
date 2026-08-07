import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Flat, { FLAT_STATUSES, type FlatStatus } from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeFlat, validateFlatPayload } from "@/lib/flat-utils";

export const runtime = "nodejs";

/**
 * GET /api/flats — public
 * Query: q (search), status (available|sold|rent)
 */
export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const status = (searchParams.get("status") || "").trim().toLowerCase();

    const filter: Record<string, unknown> = {};

    if (status && FLAT_STATUSES.includes(status as FlatStatus)) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { flatNumber: regex },
        { ownerName: regex },
        { ownerMobile: regex },
        { renterName: regex },
        { renterMobile: regex },
      ];
    }

    const flats = await Flat.find(filter).sort({ floorNumber: 1, flatNumber: 1 }).lean();

    const byFloor = new Map<
      number,
      {
        floorNumber: number;
        total: number;
        sold: number;
        rent: number;
        available: number;
        flats: ReturnType<typeof serializeFlat>[];
      }
    >();

    for (const f of flats) {
      const floorNumber = f.floorNumber;
      const group = byFloor.get(floorNumber) ?? {
        floorNumber,
        total: 0,
        sold: 0,
        rent: 0,
        available: 0,
        flats: [],
      };

      const item = serializeFlat(f as never);
      group.flats.push(item);
      group.total += 1;
      if (item.status === "sold") group.sold += 1;
      else if (item.status === "rent") group.rent += 1;
      else group.available += 1;

      byFloor.set(floorNumber, group);
    }

    const floors = Array.from(byFloor.values()).sort((a, b) => a.floorNumber - b.floorNumber);

    return NextResponse.json({
      success: true,
      total: flats.length,
      floors,
    });
  } catch (error) {
    console.error("GET /api/flats error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load flats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flats — Super Admin only
 * Creates a new flat. Flat numbers are unique — duplicates are rejected.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validateFlatPayload(body, { requireFloorFlat: true });

    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;

    const existing = await Flat.findOne({ flatNumber: data.flatNumber }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Flat No. already exists." },
        { status: 409 }
      );
    }

    try {
      const flat = await Flat.create({
        floorNumber: data.floorNumber,
        flatNumber: data.flatNumber,
        ownerName: data.ownerName,
        ownerMobile: data.ownerMobile,
        renterName: data.renterName,
        renterMobile: data.renterMobile,
        status: data.status,
        notes: data.notes,
      });

      return NextResponse.json(
        {
          success: true,
          message: "Plot details saved",
          flat: serializeFlat(flat),
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      // Mongo duplicate key (unique index on flatNumber)
      const code = err && typeof err === "object" && "code" in err ? Number((err as { code: number }).code) : 0;
      if (code === 11000) {
        return NextResponse.json(
          { success: false, message: "Flat No. already exists." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("POST /api/flats error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to save flat" },
      { status: 500 }
    );
  }
}
