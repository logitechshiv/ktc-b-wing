import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PaymentPurpose from "@/models/PaymentPurpose";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializePurpose, validatePurposePayload } from "@/lib/payment-utils";
import { getPurposeProgressStats } from "@/lib/collections-service";

export const runtime = "nodejs";

/** GET /api/payment-purposes — public, with per-round stats from MongoDB */
export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const filter: Record<string, unknown> = {};
    if (activeOnly) filter.isActive = true;

    const docs = await PaymentPurpose.find(filter).sort({ createdAt: -1 }).lean();
    const purposes = docs.map((d) => serializePurpose(d as never));
    const stats = await getPurposeProgressStats(
      purposes.map((p) => ({ id: p.id, amount: p.amount }))
    );

    return NextResponse.json({
      success: true,
      purposes,
      stats: stats.map((s) => ({
        purposeId: s.purposeId,
        total: s.total,
        collected: s.collected,
        pending: s.pending,
        pendingAmount: s.pendingAmount,
        collectedAmount: s.collectedAmount,
        collectionPercent: s.collectionPercent,
      })),
      payableFlats: stats[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("GET /api/payment-purposes error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load purposes" },
      { status: 500 }
    );
  }
}

/** POST /api/payment-purposes — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validatePurposePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const purpose = await PaymentPurpose.create(validated.data);
    return NextResponse.json(
      { success: true, message: "Purpose created", purpose: serializePurpose(purpose) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payment-purposes error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to create purpose" },
      { status: 500 }
    );
  }
}
