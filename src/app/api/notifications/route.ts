import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/require-auth";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  createNotification,
  listNotificationsForUser,
  type CreateNotificationInput,
} from "@/lib/notification-service";
import { NOTIFICATION_TYPES, type NotificationType } from "@/models/Notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 * Query: limit, status=all|unread|read
 * Auth required — returns only current user's notifications.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireAuth();
    if (gate.error) return gate.error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") || 30);
    const statusRaw = String(searchParams.get("status") || "all").toLowerCase();
    const status =
      statusRaw === "unread" || statusRaw === "read" ? statusRaw : "all";

    const result = await listNotificationsForUser({
      userId: gate.user.id,
      limit: Number.isFinite(limitRaw) ? limitRaw : 30,
      status,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load notifications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications — Super Admin only (manual / future use).
 * Normal event notifications are created server-side from CRUD routes.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const type = String(body.type || "").trim() as NotificationType;
    if (!NOTIFICATION_TYPES.includes(type)) {
      return NextResponse.json({ success: false, message: "Invalid notification type" }, { status: 400 });
    }

    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const dedupeKey =
      String(body.dedupeKey || "").trim() ||
      `${type}:manual:${gate.user.id}:${Date.now()}`;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: "Title and message are required" },
        { status: 400 }
      );
    }

    const input: CreateNotificationInput = {
      type,
      title,
      message,
      dedupeKey,
      relatedId: body.relatedId ? String(body.relatedId) : null,
      relatedType: (body.relatedType as CreateNotificationInput["relatedType"]) || null,
      meta: typeof body.meta === "object" && body.meta ? (body.meta as Record<string, unknown>) : {},
    };

    const result = await createNotification(input);
    if (!result) {
      return NextResponse.json({ success: false, message: "Unable to create notification" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, notificationId: result.notificationId, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create notification" },
      { status: 500 }
    );
  }
}
