import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/require-auth";
import { countUnreadForUser } from "@/lib/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notifications/unread-count */
export async function GET() {
  try {
    const gate = await requireAuth();
    if (gate.error) return gate.error;

    await connectDB();
    const unreadCount = await countUnreadForUser(gate.user.id);
    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    console.error("GET /api/notifications/unread-count error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load unread count" },
      { status: 500 }
    );
  }
}
