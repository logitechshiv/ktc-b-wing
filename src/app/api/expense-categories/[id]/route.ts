import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import ExpenseCategory from "@/models/ExpenseCategory";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { parseIncludeInCommonExpense } from "@/lib/common-expense-constants";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

function serializeCategory(doc: {
  _id: { toString(): string };
  name: string;
  includeInCommonExpense?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    includeInCommonExpense: doc.includeInCommonExpense === true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** PUT /api/expense-categories/[id] — Super Admin only (update in place, preserve id) */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid category id" }, { status: 400 });
    }

    await connectDB();
    const existing = await ExpenseCategory.findById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "Category name is required" }, { status: 400 });
    }

    const includeInCommonExpense = parseIncludeInCommonExpense(
      body.includeInCommonExpense,
      existing.includeInCommonExpense === true
    );

    const oid = existing._id;
    const duplicate = await ExpenseCategory.findOne({
      _id: { $ne: oid },
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    });
    if (duplicate) {
      return NextResponse.json({ success: false, message: "Category already exists" }, { status: 409 });
    }

    const previousName = String(existing.name || "").trim();

    existing.name = name;
    existing.includeInCommonExpense = includeInCommonExpense;
    await existing.save();

    // Keep expense.category strings in sync so sync-from-expenses does not re-create the old name
    if (previousName && previousName !== name) {
      await Expense.updateMany(
        { category: new RegExp(`^${escapeRegex(previousName)}$`, "i") },
        { $set: { category: name } }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Category updated",
      category: serializeCategory(existing),
    });
  } catch (error) {
    console.error("PUT /api/expense-categories/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update category" },
      { status: 500 }
    );
  }
}

/** DELETE /api/expense-categories/[id] — Super Admin only */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid category id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await ExpenseCategory.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("DELETE /api/expense-categories/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete category" },
      { status: 500 }
    );
  }
}
