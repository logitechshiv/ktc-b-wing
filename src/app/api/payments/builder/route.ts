import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  createBuilderPaymentDistribution,
  getPurposeDetails,
} from "@/lib/collections-service";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

export const runtime = "nodejs";

/**
 * POST /api/payments/builder
 * Super Admin — record builder lump-sum and distribute paid entries
 * across all unpaid Unsold (available) flats for the purpose.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();

    const paymentPurposeId = String(body.paymentPurposeId ?? body.purposeId ?? "").trim();
    const builderName = String(body.builderName ?? "").trim();
    const amount = Number(body.amount);
    const paymentMode = String(body.paymentMode ?? body.paymentMethod ?? "")
      .trim()
      .toLowerCase() as DbPaymentMode;
    const notes = String(body.notes ?? "").trim();
    const dateRaw = body.paymentDate ? String(body.paymentDate) : new Date().toISOString();
    const paymentDate = new Date(dateRaw);

    if (!paymentPurposeId) {
      return NextResponse.json({ success: false, message: "Payment Purpose is required" }, { status: 400 });
    }
    if (!builderName) {
      return NextResponse.json({ success: false, message: "Builder Name is required" }, { status: 400 });
    }
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return NextResponse.json(
        { success: false, message: "Payment Mode must be cash, bank or upi" },
        { status: 400 }
      );
    }

    const result = await createBuilderPaymentDistribution({
      paymentPurposeId,
      builderName,
      amount,
      paymentMode,
      paymentDate,
      notes,
      createdBy: gate.user.id,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    const details = await getPurposeDetails(paymentPurposeId);

    try {
      const { notifyBuilderCollectionAdded } = await import("@/lib/notification-service");
      notifyBuilderCollectionAdded({
        id: result.data.builderPaymentId,
        builderName,
        amount: result.data.totalAmount,
        flatCount: result.data.flatCount,
        purpose: details?.purpose?.title || "",
      });
    } catch (err) {
      console.error("builder payment notification error:", err);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Builder payment distributed across ${result.data.paymentsCreated} unsold flats`,
        builderPayment: result.data,
        purpose: details?.purpose ?? null,
        summary: details?.summary ?? null,
        paid: details?.paid ?? [],
        pending: details?.pending ?? [],
        unsoldPending: details?.unsoldPending ?? [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payments/builder error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to save builder payment",
      },
      { status: 500 }
    );
  }
}
