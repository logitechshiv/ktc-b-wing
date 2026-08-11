import { NextResponse } from "next/server";
import { getKiran3CommonBalance } from "@/lib/kiran3-common-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard/kiran3-common — society advance vs included common expenses */
export async function GET() {
  try {
    const data = await getKiran3CommonBalance();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("GET /api/dashboard/kiran3-common error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to load Kiran 3 Common balance",
      },
      { status: 500 }
    );
  }
}
