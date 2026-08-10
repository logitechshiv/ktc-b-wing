import { NextResponse } from "next/server";
import { getCommonExpenseSplit } from "@/lib/common-expense-split-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard/common-expense-split?month=&year= */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get("month") || now.getMonth() + 1);
    const year = Number(searchParams.get("year") || now.getFullYear());

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Invalid month" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(year) || year < 1970 || year > 2100) {
      return NextResponse.json(
        { success: false, message: "Invalid year" },
        { status: 400 }
      );
    }

    const data = await getCommonExpenseSplit(month, year);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("GET /api/dashboard/common-expense-split error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to load common expense split",
      },
      { status: 500 }
    );
  }
}
