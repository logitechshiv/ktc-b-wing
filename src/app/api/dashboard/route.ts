import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard — live fund, flats & vehicles summary */
export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load dashboard",
      },
      { status: 500 }
    );
  }
}
