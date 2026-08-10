import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { deleteNotificationAsAdmin } from "@/lib/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/**
 * DELETE /api/notifications/[id]
 * Super Admin only — permanently deletes the notification for everyone.
 * Normal users receive 403 Forbidden.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) {
      // requireSuperAdmin returns 401/403 — map non-super-admin to 403 Forbidden
      if (gate.error.status === 401) return gate.error;
      return NextResponse.json(
        { success: false, message: "Forbidden. Super Admin access required." },
        { status: 403 }
      );
    }

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid notification id" }, { status: 400 });
    }

    await connectDB();
    const ok = await deleteNotificationAsAdmin(id);
    if (!ok) {
      return NextResponse.json({ success: false, message: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Notification deleted from MongoDB",
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete notification" },
      { status: 500 }
    );
  }
}
