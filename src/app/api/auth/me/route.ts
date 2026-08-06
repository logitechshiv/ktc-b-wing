import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ success: false, message: "Unable to fetch user" }, { status: 500 });
  }
}
