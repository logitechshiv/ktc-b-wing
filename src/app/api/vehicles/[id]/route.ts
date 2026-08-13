import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Vehicle from "@/models/Vehicle";
import Flat from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeVehicle, validateVehiclePayload } from "@/lib/vehicle-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** GET /api/vehicles/[id] — public */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle id" }, { status: 400 });
    }

    await connectDB();
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return NextResponse.json({ success: false, message: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, vehicle: serializeVehicle(vehicle) });
  } catch (error) {
    console.error("GET /api/vehicles/[id] error:", error);
    return NextResponse.json({ success: false, message: "Unable to load vehicle" }, { status: 500 });
  }
}

/** PUT /api/vehicles/[id] — Super Admin only */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const validated = validateVehiclePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;

    // Flats are the single source of truth for contact details
    const flat = data.flatId
      ? await Flat.findById(data.flatId).lean()
      : await Flat.findOne({ flatNumber: data.flatNumber }).lean();

    if (!flat) {
      return NextResponse.json(
        { success: false, message: "Selected flat was not found" },
        { status: 400 }
      );
    }

    const wantsRenter = data.vehicleOwnerType === "renter";
    const flatOwnerName = String(flat.ownerName || "").trim();
    const flatRenterName = String(flat.renterName || "").trim();
    const flatOwnerMobile = String(flat.ownerMobile || "").trim();
    const flatRenterMobile = String(flat.renterMobile || "").trim();

    if (wantsRenter) {
      if (!flatRenterName && !flatRenterMobile) {
        return NextResponse.json(
          { success: false, message: "No renter is available for this flat" },
          { status: 400 }
        );
      }
      if (!flatRenterName) {
        return NextResponse.json(
          { success: false, message: "Renter name is required for this flat" },
          { status: 400 }
        );
      }
    } else if (!flatOwnerName) {
      return NextResponse.json(
        { success: false, message: "કોઈ માલિક નથી — cannot save a vehicle for this flat" },
        { status: 400 }
      );
    }

    const contactName = wantsRenter ? flatRenterName : flatOwnerName;
    const contactMobile = wantsRenter ? flatRenterMobile : flatOwnerMobile;
    if (data.vehicleNumber) {
      const duplicate = await Vehicle.findOne({
        vehicleNumber: data.vehicleNumber,
        _id: { $ne: id },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "Vehicle Number already exists" },
          { status: 409 }
        );
      }
    }

    const setFields: Record<string, unknown> = {
      floorNumber: flat.floorNumber,
      flatNumber: String(flat.flatNumber),
      flatId: flat._id,
      vehicleOwnerType: wantsRenter ? "renter" : "owner",
      ownerName: contactName,
      ownerMobile: contactMobile,
      vehicleType: data.vehicleType,
      vehicleNumber: data.vehicleNumber,
      stickerIssued: data.stickerIssued,
      stickerNumber: "",
      color: "",
      brand: "",
      model: "",
      notes: data.notes,
    };
    const unsetFields: Record<string, "" | 1> = {
      ownerNameGujarati: "",
    };

    // Cycles may have no plate — clear field so sparse unique index allows multiples
    if (!data.vehicleNumber) {
      delete setFields.vehicleNumber;
      unsetFields.vehicleNumber = 1;
    }

    const updated = await Vehicle.findByIdAndUpdate(
      id,
      {
        $set: setFields,
        $unset: unsetFields,
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Vehicle updated",
      vehicle: serializeVehicle(updated),
    });
  } catch (error) {
    console.error("PUT /api/vehicles/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update vehicle" },
      { status: 500 }
    );
  }
}

/** DELETE /api/vehicles/[id] — Super Admin only (does not affect flats) */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Vehicle.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Vehicle deleted" });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete vehicle" },
      { status: 500 }
    );
  }
}
