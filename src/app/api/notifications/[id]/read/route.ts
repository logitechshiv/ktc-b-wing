import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/require-auth";
import {
  markNotificationReadForUser,
  countUnreadForUser,
} from "@/lib/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** PATCH /api/notifications/[id]/read — mark one as read for current user */
export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const gate = await requireAuth();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid notification id" }, { status: 400 });
    }

    await connectDB();
    const notification = await markNotificationReadForUser(gate.user.id, id);
    if (!notification) {
      return NextResponse.json({ success: false, message: "Notification not found" }, { status: 404 });
    }

    const unreadCount = await countUnreadForUser(gate.user.id);
    return NextResponse.json({
      success: true,
      notification,
      unreadCount,
    });
  } catch (error) {
    console.error("PATCH /api/notifications/[id]/read error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to mark notification as read" },
      { status: 500 }
    );
  }
}
