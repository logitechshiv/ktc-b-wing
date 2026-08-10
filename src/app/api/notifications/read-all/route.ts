import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/require-auth";
import { markAllNotificationsReadForUser, countUnreadForUser } from "@/lib/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/notifications/read-all — mark all as read for current user */
export async function PATCH() {
  try {
    const gate = await requireAuth();
    if (gate.error) return gate.error;

    await connectDB();
    const modified = await markAllNotificationsReadForUser(gate.user.id);
    const unreadCount = await countUnreadForUser(gate.user.id);

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
      modified,
      unreadCount,
    });
  } catch (error) {
    console.error("PATCH /api/notifications/read-all error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to mark notifications as read" },
      { status: 500 }
    );
  }
}
