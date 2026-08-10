import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Notice from "@/models/Notice";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeNotice, validateNoticePayload } from "@/lib/notice-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notices
 * Query: q, limit
 * Public — guests can view. Sorted by createdAt DESC.
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 0;

    const filter: Record<string, unknown> = {};
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    let query = Notice.find(filter).sort({ createdAt: -1, _id: -1 });
    if (limit > 0) query = query.limit(limit);

    const docs = await query.lean();
    return NextResponse.json({
      success: true,
      notices: docs.map((d) => serializeNotice(d as never)),
      total: docs.length,
    });
  } catch (error) {
    console.error("GET /api/notices error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load notices" },
      { status: 500 }
    );
  }
}

/** POST /api/notices — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validateNoticePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const notice = await Notice.create(validated.data);
    return NextResponse.json(
      { success: true, message: "Notice added", notice: serializeNotice(notice) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/notices error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to create notice" },
      { status: 500 }
    );
  }
}
