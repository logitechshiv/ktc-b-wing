import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import PaymentPurpose from "@/models/PaymentPurpose";
import Payment from "@/models/Payment";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializePurpose, validatePurposePayload } from "@/lib/payment-utils";
import { getPurposeDetails } from "@/lib/collections-service";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/**
 * GET /api/payment-purposes/[id]
 * Public — returns purpose + paid/pending flat breakdown from MongoDB.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid purpose id" }, { status: 400 });
    }

    await connectDB();
    const details = await getPurposeDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, message: "Purpose not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      purpose: details.purpose,
      summary: details.summary,
      paid: details.paid,
      pending: details.pending,
      unsoldPending: details.unsoldPending,
    });
  } catch (error) {
    console.error("GET /api/payment-purposes/[id] error:", error);
    return NextResponse.json({ success: false, message: "Unable to load purpose" }, { status: 500 });
  }
}

/** PUT /api/payment-purposes/[id] — Super Admin only */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid purpose id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const validated = validatePurposePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const updated = await PaymentPurpose.findByIdAndUpdate(
      id,
      { $set: validated.data },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json({ success: false, message: "Purpose not found" }, { status: 404 });
    }

    await Payment.updateMany(
      { paymentPurposeId: id },
      { $set: { paymentPurpose: validated.data.title } }
    );

    // Drop legacy `amount` if present so amountPerFlat is the source of truth
    await PaymentPurpose.updateOne({ _id: id }, { $unset: { amount: 1 } });

    return NextResponse.json({
      success: true,
      message: "Purpose updated",
      purpose: serializePurpose(updated),
    });
  } catch (error) {
    console.error("PUT /api/payment-purposes/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update purpose" },
      { status: 500 }
    );
  }
}

/** DELETE /api/payment-purposes/[id] — Super Admin only (cascades related payments) */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid purpose id" }, { status: 400 });
    }

    await connectDB();

    const purpose = await PaymentPurpose.findById(id);
    if (!purpose) {
      return NextResponse.json({ success: false, message: "Purpose not found" }, { status: 404 });
    }

    // Remove related payment records first, then the purpose
    const purposeObjectId = new mongoose.Types.ObjectId(id);
    const paymentsResult = await Payment.deleteMany({ paymentPurposeId: purposeObjectId });
    await PaymentPurpose.findByIdAndDelete(purposeObjectId);

    return NextResponse.json({
      success: true,
      message: "Purpose deleted",
      deletedPayments: paymentsResult.deletedCount ?? 0,
    });
  } catch (error) {
    console.error("DELETE /api/payment-purposes/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete purpose" },
      { status: 500 }
    );
  }
}
