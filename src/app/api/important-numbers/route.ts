import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ImportantNumber from "@/models/ImportantNumber";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  serializeImportantNumber,
  validateImportantNumberPayload,
} from "@/lib/important-number-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/important-numbers
 * Query: all=1 (Super Admin only — includes inactive)
 * Public default — active only, sorted by displayOrder ASC then createdAt DESC.
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const wantAll = searchParams.get("all") === "1" || searchParams.get("all") === "true";

    if (wantAll) {
      const gate = await requireSuperAdmin();
      if (gate.error) return gate.error;
    }

    const filter: Record<string, unknown> = wantAll ? {} : { isActive: true };
    const docs = await ImportantNumber.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();

    return NextResponse.json({
      success: true,
      importantNumbers: docs.map((d) => serializeImportantNumber(d as never)),
      total: docs.length,
    });
  } catch (error) {
    console.error("GET /api/important-numbers error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load important numbers",
      },
      { status: 500 }
    );
  }
}

/** POST /api/important-numbers — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validateImportantNumberPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const created = await ImportantNumber.create(validated.data);
    return NextResponse.json(
      {
        success: true,
        message: "Important number added",
        importantNumber: serializeImportantNumber(created),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/important-numbers error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to create important number",
      },
      { status: 500 }
    );
  }
}
