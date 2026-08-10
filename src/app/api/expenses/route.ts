import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Expense from "@/models/Expense";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import { serializeExpense, validateExpensePayload } from "@/lib/expense-utils";
import { getNextDisplayOrder } from "@/lib/expense-order";

export const runtime = "nodejs";

/**
 * GET /api/expenses
 * Query: q, category
 * Public — guests can view.
 * Sorted by creation order (oldest first).
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const category = (searchParams.get("category") || "").trim();

    const filter: Record<string, unknown> = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { expenseTitleGujarati: regex },
        { expenseTitle: regex },
        { category: regex },
        { notes: regex },
      ];
    }

    const docs = await Expense.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
    const expenses = docs.map((d) => serializeExpense(d as never));
    const shownTotal = expenses.reduce((s, e) => s + e.amount, 0);

    const [allCount, allAgg, categories, nextDisplayOrder] = await Promise.all([
      Expense.countDocuments({}),
      Expense.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
      Expense.distinct("category"),
      getNextDisplayOrder(),
    ]);

    return NextResponse.json({
      success: true,
      expenses,
      total: expenses.length,
      shownTotal,
      nextDisplayOrder,
      categories: (categories as string[]).filter(Boolean).sort(),
      summary: {
        totalExpenses: allCount,
        totalAmount: allAgg[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load expenses" },
      { status: 500 }
    );
  }
}

/** POST /api/expenses — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const validated = validateExpensePayload(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, message: validated.message }, { status: 400 });
    }

    const { data } = validated;
    const displayOrder = await getNextDisplayOrder();

    const expense = await Expense.create({
      ...data,
      displayOrder,
      createdBy: gate.user.id,
    });

    return NextResponse.json(
      { success: true, message: "Expense added", expense: serializeExpense(expense) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to create expense" },
      { status: 500 }
    );
  }
}
