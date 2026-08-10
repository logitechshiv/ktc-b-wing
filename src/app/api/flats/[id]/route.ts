import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Flat from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeFlat, validateFlatPayload } from "@/lib/flat-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** GET /api/flats/[id] — public */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid flat id" }, { status: 400 });
    }

    await connectDB();
    const flat = await Flat.findById(id).lean();
    if (!flat) {
      return NextResponse.json({ success: false, message: "Flat not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, flat: serializeFlat(flat as never) });
  } catch (error) {
    console.error("GET /api/flats/[id] error:", error);
    return NextResponse.json({ success: false, message: "Unable to load flat" }, { status: 500 });
  }
}

/**
 * PUT /api/flats/[id] — Super Admin only
 * Updates owner/renter/status/notes via findByIdAndUpdate and returns the updated doc.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid flat id" }, { status: 400 });
    }

    await connectDB();
    const existing = await Flat.findById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Flat not found" }, { status: 404 });
    }

    const body = await request.json();

    // Prefer existing floor/flat identity so disabled form fields cannot blank the key
    const validated = validateFlatPayload(
      {
        ...body,
        floorNumber: existing.floorNumber,
        flatNumber: existing.flatNumber,
        status: body.status ?? existing.status,
      },
      { requireFloorFlat: false }
    );

    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;

    const before = {
      ownerName: String(existing.ownerName || "").trim(),
      ownerMobile: String(existing.ownerMobile || "").trim(),
      renterName: String(existing.renterName || "").trim(),
      renterMobile: String(existing.renterMobile || "").trim(),
    };

    const updated = await Flat.findByIdAndUpdate(
      id,
      {
        $set: {
          ownerName: data.ownerName,
          ownerMobile: data.ownerMobile,
          renterName: data.renterName,
          renterMobile: data.renterMobile,
          status: data.status,
          notes: data.notes,
        },
        $unset: {
          ownerNameGujarati: "",
          renterNameGujarati: "",
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Flat not found" }, { status: 404 });
    }

    const serialized = serializeFlat(updated);
    try {
      const { notifyFlatDetailsUpdated } = await import("@/lib/notification-service");
      await notifyFlatDetailsUpdated({
        id: serialized.id,
        flatNumber: serialized.flatNumber,
        before,
        after: {
          ownerName: serialized.ownerName,
          ownerMobile: serialized.ownerMobile,
          renterName: serialized.renterName,
          renterMobile: serialized.renterMobile,
        },
        actorUserId: gate.user.id,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      console.error("flat update notification error:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Plot details updated",
      flat: serialized,
    });
  } catch (error) {
    console.error("PUT /api/flats/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to update flat",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flats/[id] — Super Admin only
 * Does NOT remove the flat document.
 * Clears owner/renter/notes and resets status to "available".
 * Flat card (floorNumber + flatNumber) always remains.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid flat id" }, { status: 400 });
    }

    await connectDB();

    const updated = await Flat.findByIdAndUpdate(
      id,
      {
        $set: {
          ownerName: "",
          ownerMobile: "",
          renterName: "",
          renterMobile: "",
          notes: "",
          status: "available",
        },
        $unset: {
          ownerNameGujarati: "",
          renterNameGujarati: "",
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Flat not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Flat details cleared",
      flat: serializeFlat(updated),
    });
  } catch (error) {
    console.error("DELETE /api/flats/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to clear flat details",
      },
      { status: 500 }
    );
  }
}
