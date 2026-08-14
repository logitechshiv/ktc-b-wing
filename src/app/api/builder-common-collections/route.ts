import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  createBuilderCommonCollection,
  listBuilderCommonCollections,
} from "@/lib/builder-common-collection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/builder-common-collections?month=&year=&category=&limit= */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month")
      ? Number(searchParams.get("month"))
      : undefined;
    const year = searchParams.get("year")
      ? Number(searchParams.get("year"))
      : undefined;
    const category = (searchParams.get("category") || "").trim() || undefined;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;

    const collections = await listBuilderCommonCollections({
      month,
      year,
      category,
      limit,
    });

    return NextResponse.json({ success: true, collections });
  } catch (error) {
    console.error("GET /api/builder-common-collections error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load builder collections",
      },
      { status: 500 }
    );
  }
}

/** POST /api/builder-common-collections — Super Admin */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const body = await request.json();
    const collection = await createBuilderCommonCollection(body, gate.user.id);
    return NextResponse.json({ success: true, collection }, { status: 201 });
  } catch (error) {
    console.error("POST /api/builder-common-collections error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to save builder collection",
      },
      { status: 400 }
    );
  }
}
