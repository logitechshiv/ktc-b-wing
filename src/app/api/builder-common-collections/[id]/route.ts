import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  deleteBuilderCommonCollection,
  updateBuilderCommonCollection,
} from "@/lib/builder-common-collection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/builder-common-collections/[id] — Super Admin */
export async function PUT(request: Request, context: Ctx) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, message: "Collection id is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const collection = await updateBuilderCommonCollection(id.trim(), body);
    return NextResponse.json({ success: true, collection });
  } catch (error) {
    console.error("PUT /api/builder-common-collections/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update builder collection",
      },
      { status: 400 }
    );
  }
}

/** DELETE /api/builder-common-collections/[id] — Super Admin */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, message: "Collection id is required" },
        { status: 400 }
      );
    }

    await deleteBuilderCommonCollection(id.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/builder-common-collections/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete builder collection",
      },
      { status: 400 }
    );
  }
}
