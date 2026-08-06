import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeExpense } from "@/lib/expense-utils";

export const runtime = "nodejs";

type ReorderItem = { _id?: string; id?: string; displayOrder: number };

/**
 * PUT /api/expenses/reorder
 * Super Admin — bulk update displayOrder via bulkWrite (two-phase to avoid unique clashes).
 */
export async function PUT(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : body?.items;

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { success: false, message: "Provide an array of { _id, displayOrder }" },
        { status: 400 }
      );
    }

    const items: { id: string; displayOrder: number }[] = [];
    const seenOrders = new Set<number>();
    const seenIds = new Set<string>();

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i] as ReorderItem;
      const id = String(row._id ?? row.id ?? "").trim();
      const displayOrder = Number(row.displayOrder);

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, message: `Invalid expense id at index ${i}` },
          { status: 400 }
        );
      }
      if (!Number.isInteger(displayOrder) || displayOrder < 1) {
        return NextResponse.json(
          { success: false, message: `Invalid displayOrder at index ${i}` },
          { status: 400 }
        );
      }
      if (seenIds.has(id)) {
        return NextResponse.json(
          { success: false, message: `Duplicate expense id: ${id}` },
          { status: 400 }
        );
      }
      if (seenOrders.has(displayOrder)) {
        return NextResponse.json(
          { success: false, message: `Duplicate displayOrder: ${displayOrder}` },
          { status: 400 }
        );
      }
      seenIds.add(id);
      seenOrders.add(displayOrder);
      items.push({ id, displayOrder });
    }

    // Phase 1: temp negative orders to avoid unique index conflicts
    await Expense.bulkWrite(
      items.map((item, index) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { displayOrder: -(index + 1) } },
        },
      })),
      { ordered: true }
    );

    // Phase 2: final 1..n orders
    await Expense.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { displayOrder: item.displayOrder } },
        },
      })),
      { ordered: true }
    );

    const docs = await Expense.find({ _id: { $in: items.map((i) => i.id) } })
      .sort({ displayOrder: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      message: "Expense order updated",
      expenses: docs.map((d) => serializeExpense(d as never)),
    });
  } catch (error) {
    console.error("PUT /api/expenses/reorder error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to reorder expenses",
      },
      { status: 500 }
    );
  }
}
