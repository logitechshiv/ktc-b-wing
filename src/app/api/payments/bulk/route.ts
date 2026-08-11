import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Payment, { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";
import PaymentPurpose from "@/models/PaymentPurpose";
import Flat from "@/models/Flat";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializePayment } from "@/lib/payment-utils";
import { hasExistingPayment } from "@/lib/collections-service";

export const runtime = "nodejs";

type BulkItem = {
  flatId: string;
  ownerName: string;
  ownerType: "Owner" | "Renter";
};

/**
 * POST /api/payments/bulk
 * Super Admin — create one payment per selected Owner/Renter.
 * Skips flats that already paid for the purpose (no hard fail).
 */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();

    const paymentPurposeId = String(body.paymentPurposeId ?? body.purposeId ?? "").trim();
    const amount = Number(body.amount);
    const paymentMode = String(body.paymentMode ?? body.paymentMethod ?? "")
      .trim()
      .toLowerCase() as DbPaymentMode;
    const notes = String(body.notes ?? "").trim();
    const dateRaw = body.paymentDate ? String(body.paymentDate) : new Date().toISOString();
    const paymentDate = new Date(dateRaw);
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!paymentPurposeId || !mongoose.Types.ObjectId.isValid(paymentPurposeId)) {
      return NextResponse.json({ success: false, message: "Payment Purpose is required" }, { status: 400 });
    }
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return NextResponse.json(
        { success: false, message: "Payment Mode must be cash, bank, upi or cheque" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: "Amount must be greater than 0" }, { status: 400 });
    }
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ success: false, message: "Payment Date is invalid" }, { status: 400 });
    }
    if (rawItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Select at least one Owner/Renter" },
        { status: 400 }
      );
    }

    const purpose = await PaymentPurpose.findById(paymentPurposeId);
    if (!purpose) {
      return NextResponse.json({ success: false, message: "Purpose not found" }, { status: 404 });
    }

    const items: BulkItem[] = [];
    const seenKeys = new Set<string>();
    let skippedInBatch = 0;

    for (const raw of rawItems) {
      const flatId = String(raw?.flatId ?? "").trim();
      const ownerName = String(raw?.ownerName ?? "").trim();
      const ownerTypeRaw = String(raw?.ownerType ?? "").trim();
      const ownerType: "Owner" | "Renter" =
        ownerTypeRaw === "Renter" ? "Renter" : "Owner";
      if (!flatId || !mongoose.Types.ObjectId.isValid(flatId)) continue;

      // One payment per flat per purpose — skip extra Owner/Renter for same flat in this batch
      const flatKey = flatId;
      if (seenKeys.has(flatKey)) {
        skippedInBatch += 1;
        continue;
      }
      seenKeys.add(flatKey);
      items.push({ flatId, ownerName, ownerType });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Select at least one Owner/Renter" },
        { status: 400 }
      );
    }

    let created = 0;
    let skippedExisting = 0;
    const payments = [];

    for (const item of items) {
      const flat = await Flat.findById(item.flatId);
      if (!flat) {
        skippedExisting += 1;
        continue;
      }

      const status = String(flat.status || "");
      if (status !== "sold" && status !== "rent") {
        skippedExisting += 1;
        continue;
      }

      if (await hasExistingPayment(purpose._id.toString(), String(flat.flatNumber))) {
        skippedExisting += 1;
        continue;
      }

      const payerName =
        item.ownerName ||
        (item.ownerType === "Renter"
          ? String(flat.renterName || "").trim()
          : String(flat.ownerName || "").trim());

      const hasOwner = !!String(flat.ownerName || "").trim();
      const hasRenter = !!String(flat.renterName || "").trim();
      if (!payerName || (!hasOwner && !hasRenter)) {
        skippedExisting += 1;
        continue;
      }

      try {
        const payment = await Payment.create({
          flatId: flat._id,
          floorNumber: flat.floorNumber,
          flatNumber: flat.flatNumber,
          ownerName: payerName || flat.ownerName || "",
          ownerType: item.ownerType,
          paymentPurposeId: purpose._id,
          paymentPurpose: purpose.title,
          amount,
          paymentMode,
          paymentDate,
          paymentSource: "owner",
          whatsappSent: false,
          notes,
          createdBy: gate.user.id,
        });
        const serialized = serializePayment(payment);
        payments.push(serialized);
        created += 1;
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
          console.error("bulk payment notification error:", err);
        }
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "code" in err
            ? Number((err as { code: number }).code)
            : 0;
        if (code === 11000) {
          skippedExisting += 1;
          continue;
        }
        throw err;
      }
    }

    const skipped = skippedExisting + skippedInBatch;
    let message = "";
    if (created > 0 && skipped > 0) {
      message = `${created} payment${created === 1 ? "" : "s"} added successfully. ${skipped} payment${skipped === 1 ? "" : "s"} already exists.`;
    } else if (created > 0) {
      message = `${created} payment${created === 1 ? "" : "s"} added successfully.`;
    } else if (skipped > 0) {
      message = `${skipped} payment${skipped === 1 ? "" : "s"} already exists.`;
    } else {
      message = "No payments were created.";
    }

    return NextResponse.json(
      {
        success: created > 0,
        message,
        created,
        skipped,
        payments,
      },
      { status: created > 0 ? 201 : 409 }
    );
  } catch (error) {
    console.error("POST /api/payments/bulk error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to save payments",
      },
      { status: 500 }
    );
  }
}
