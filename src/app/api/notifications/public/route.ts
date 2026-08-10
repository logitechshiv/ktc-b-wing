import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import {
  listNotificationsForUser,
  listPublicNotifications,
} from "@/lib/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/public
 * Available to everyone (guests + all roles).
 * If logged in, returns that user's read/unread state.
 * If guest, returns feed with isRead=false (client may track locally).
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") || 30);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 30;
    const statusRaw = String(searchParams.get("status") || "all").toLowerCase();
    const status =
      statusRaw === "unread" || statusRaw === "read" ? statusRaw : "all";

    const user = await getCurrentUser();
    if (user) {
      const result = await listNotificationsForUser({
        userId: user.id,
        limit,
        status,
      });
      return NextResponse.json({
        success: true,
        authenticated: true,
        notifications: result.notifications,
        unreadCount: result.unreadCount,
      });
    }

    // Guest: public society feed
    let notifications = await listPublicNotifications({ limit: Math.max(limit, 50) });
    if (status === "unread") {
      // guests handle unread client-side; return all and let client filter
    } else if (status === "read") {
      notifications = [];
    }

    return NextResponse.json({
      success: true,
      authenticated: false,
      notifications,
      unreadCount: notifications.length,
    });
  } catch (error) {
    console.error("GET /api/notifications/public error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load notifications" },
      { status: 500 }
    );
  }
}
