import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeExpense, validateExpensePayload } from "@/lib/expense-utils";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return String(params?.id ?? "").trim();
}

/** PATCH — mark WhatsApp shared */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid expense id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.whatsappShared === "boolean") patch.whatsappShared = body.whatsappShared;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, message: "Nothing to update" }, { status: 400 });
    }

    const updated = await Expense.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, message: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Expense updated",
      expense: serializeExpense(updated),
    });
  } catch (error) {
    console.error("PATCH /api/expenses/[id] error:", error);
    return NextResponse.json({ success: false, message: "Unable to update expense" }, { status: 500 });
  }
}

/** PUT /api/expenses/[id] — Super Admin (does not change createdAt or displayOrder) */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid expense id" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const validated = validateExpensePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;

    // Only patch editable fields — never touch createdAt or displayOrder (list order stays fixed).
    const updated = await Expense.findByIdAndUpdate(
      id,
      {
        $set: {
          category: data.category,
          expenseTitleGujarati: data.expenseTitleGujarati,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          expenseDate: data.expenseDate,
          billImage: data.billImage,
          billImages: data.billImages,
          notes: data.notes,
          whatsappShared: data.whatsappShared,
        },
        $unset: {
          expenseTitle: "",
          expenseMethod: "",
          collectionPurposeId: "",
          collectionPurposeName: "",
        },
      },
      { new: true, runValidators: true, timestamps: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Expense updated",
      expense: serializeExpense(updated),
    });
  } catch (error) {
    console.error("PUT /api/expenses/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update expense" },
      { status: 500 }
    );
  }
}

/** DELETE /api/expenses/[id] — Super Admin */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const id = await resolveId(context);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid expense id" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("DELETE /api/expenses/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to delete expense" },
      { status: 500 }
    );
  }
}
