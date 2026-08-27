import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import ImportantNumber from "@/models/ImportantNumber";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  serializeImportantNumber,
  validateImportantNumberPayload,
} from "@/lib/important-number-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** PUT /api/important-numbers/[id] — Super Admin only */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid important number id" },
        { status: 400 }
      );
    }

    await connectDB();
    const body = await request.json();
    const validated = validateImportantNumberPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const updated = await ImportantNumber.findByIdAndUpdate(
      id,
      { $set: validated.data },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Important number not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Important number updated",
      importantNumber: serializeImportantNumber(updated),
    });
  } catch (error) {
    console.error("PUT /api/important-numbers/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to update important number",
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/important-numbers/[id] — Super Admin only */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid important number id" },
        { status: 400 }
      );
    }

    await connectDB();
    const deleted = await ImportantNumber.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Important number not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Important number deleted" });
  } catch (error) {
    console.error("DELETE /api/important-numbers/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to delete important number",
      },
      { status: 500 }
    );
  }
}
