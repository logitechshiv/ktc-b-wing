import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializePayment, validatePaymentPayload } from "@/lib/payment-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** PATCH /api/payments/[id] — mark WhatsApp sent, etc. Super Admin */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid payment id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.whatsappSent === "boolean") patch.whatsappSent = body.whatsappSent;
    if (typeof body.notes === "string") patch.notes = body.notes.trim();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, message: "Nothing to update" }, { status: 400 });
    }

    const updated = await Payment.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated",
      payment: serializePayment(updated),
    });
  } catch (error) {
    console.error("PATCH /api/payments/[id] error:", error);
    return NextResponse.json({ success: false, message: "Unable to update payment" }, { status: 500 });
  }
}

/** PUT /api/payments/[id] — Super Admin */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid payment id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const validated = validatePaymentPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const updated = await Payment.findByIdAndUpdate(
      id,
      { $set: validated.data },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated",
      payment: serializePayment(updated),
    });
  } catch (error) {
    console.error("PUT /api/payments/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update payment" },
      { status: 500 }
    );
  }
}

/** DELETE /api/payments/[id] — Super Admin */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid payment id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Payment.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Payment deleted" });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete payment" },
      { status: 500 }
    );
  }
}
