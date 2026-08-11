import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import PaymentPurpose from "@/models/PaymentPurpose";
import Flat from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializePayment, validatePaymentPayload } from "@/lib/payment-utils";
import { hasExistingPayment, listPaymentsGrouped } from "@/lib/collections-service";

export const runtime = "nodejs";

/**
 * GET /api/payments
 * Query: q, purposeId, mode=cash|bank|upi
 * When purposeId is set, returns only that round's payments + summary.
 */
export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const purposeId = (searchParams.get("purposeId") || "").trim();
    const mode = (searchParams.get("mode") || "").trim().toLowerCase();

    const result = await listPaymentsGrouped({ q, purposeId, mode });

    return NextResponse.json({
      success: true,
      payments: result.payments,
      groups: result.groups,
      total: result.payments.length,
      shownTotal: result.shownTotal,
      summary: result.summary,
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load payments" },
      { status: 500 }
    );
  }
}

/** POST /api/payments — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validatePaymentPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;

    if (!mongoose.Types.ObjectId.isValid(data.flatId)) {
      return NextResponse.json({ success: false, message: "Invalid flat id" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(data.paymentPurposeId)) {
      return NextResponse.json({ success: false, message: "Invalid purpose id" }, { status: 400 });
    }

    const [flat, purpose] = await Promise.all([
      Flat.findById(data.flatId),
      PaymentPurpose.findById(data.paymentPurposeId),
    ]);

    if (!flat) {
      return NextResponse.json({ success: false, message: "Flat not found" }, { status: 404 });
    }
    if (!purpose) {
      return NextResponse.json({ success: false, message: "Purpose not found" }, { status: 404 });
    }

    const hasOwner = !!String(flat.ownerName || "").trim();
    if (!hasOwner) {
      return NextResponse.json(
        { success: false, message: "Cannot collect payment — this flat has no owner" },
        { status: 400 }
      );
    }

    if (await hasExistingPayment(purpose._id.toString(), flat.flatNumber)) {
      return NextResponse.json(
        {
          success: false,
          message: `Flat ${flat.flatNumber} already paid for "${purpose.title}"`,
        },
        { status: 409 }
      );
    }

    const payment = await Payment.create({
      flatId: flat._id,
      floorNumber: flat.floorNumber,
      flatNumber: flat.flatNumber,
      ownerName: data.ownerName || flat.ownerName || "",
      ownerType: String(body.ownerType || "").trim() === "Renter" ? "Renter" : "Owner",
      paymentPurposeId: purpose._id,
      paymentPurpose: purpose.title,
      amount: data.amount,
      paymentMode: data.paymentMode,
      paymentDate: data.paymentDate,
      paymentSource: "owner",
      whatsappSent: data.whatsappSent,
      notes: data.notes,
      createdBy: gate.user.id,
    });

    const serialized = serializePayment(payment);
    try {
      const { notifyCollectionAdded } = await import("@/lib/notification-service");
      notifyCollectionAdded({
        id: serialized.id,
        flatNumber: serialized.flatNumber,
        ownerName: serialized.ownerName,
        amount: serialized.amount,
        purpose: serialized.paymentPurpose,
        purposeId: serialized.paymentPurposeId,
      });
    } catch (err) {
      console.error("payment notification error:", err);
    }

    return NextResponse.json(
      { success: true, message: "Payment saved", payment: serialized },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payments error:", error);
    const code =
      error && typeof error === "object" && "code" in error
        ? Number((error as { code: number }).code)
        : 0;
    if (code === 11000) {
      return NextResponse.json(
        { success: false, message: "This flat already has a payment for this purpose" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to save payment" },
      { status: 500 }
    );
  }
}
