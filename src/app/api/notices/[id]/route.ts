import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Notice from "@/models/Notice";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeNotice, validateNoticePayload } from "@/lib/notice-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** PUT /api/notices/[id] — Super Admin only */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid notice id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const validated = validateNoticePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const updated = await Notice.findByIdAndUpdate(
      id,
      {
        $set: {
          title: validated.data.title,
          description: validated.data.description,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Notice not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Notice updated",
      notice: serializeNotice(updated),
    });
  } catch (error) {
    console.error("PUT /api/notices/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update notice" },
      { status: 500 }
    );
  }
}

/** DELETE /api/notices/[id] — Super Admin only */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid notice id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Notice.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Notice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Notice deleted" });
  } catch (error) {
    console.error("DELETE /api/notices/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete notice" },
      { status: 500 }
    );
  }
}
