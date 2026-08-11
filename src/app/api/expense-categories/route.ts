import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ExpenseCategory from "@/models/ExpenseCategory";
import { requireSuperAdmin } from "@/lib/require-super-admin";
import {
  defaultIncludeInCommonExpense,
  parseIncludeInCommonExpense,
} from "@/lib/common-expense-constants";
import { ensureExpenseCategoryCommonFlags, syncExpenseCategoriesFromExpenses } from "@/lib/expense-category-common";

export const runtime = "nodejs";

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

/** GET /api/expense-categories — public list (seeds from expenses if empty) */
export async function GET() {
  try {
    await connectDB();
    await syncExpenseCategoriesFromExpenses();
    let docs = await ExpenseCategory.find({}).sort({ name: 1 }).lean();

    // First load: seed category chips from existing expense categories
    if (docs.length === 0) {
      const Expense = (await import("@/models/Expense")).default;
      const names = (await Expense.distinct("category"))
        .map((n) => String(n || "").trim())
        .filter(Boolean);
      if (names.length > 0) {
        await ExpenseCategory.insertMany(
          names.map((name) => ({
            name,
            includeInCommonExpense: defaultIncludeInCommonExpense(name),
          })),
          { ordered: false }
        ).catch(() => {
          /* ignore duplicate races */
        });
        docs = await ExpenseCategory.find({}).sort({ name: 1 }).lean();
      }
    } else {
      await ensureExpenseCategoryCommonFlags();
      docs = await ExpenseCategory.find({}).sort({ name: 1 }).lean();
    }

    return NextResponse.json({
      success: true,
      categories: docs.map((d) => serializeCategory(d as never)),
    });
  } catch (error) {
    console.error("GET /api/expense-categories error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to load categories" },
      { status: 500 }
    );
  }
}

/** POST /api/expense-categories — Super Admin only */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    await connectDB();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "Category name is required" }, { status: 400 });
    }

    const includeInCommonExpense = parseIncludeInCommonExpense(
      body.includeInCommonExpense,
      false
    );

    const existing = await ExpenseCategory.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (existing) {
      return NextResponse.json({ success: false, message: "Category already exists" }, { status: 409 });
    }

    const category = await ExpenseCategory.create({ name, includeInCommonExpense });
    return NextResponse.json(
      { success: true, message: "Category added", category: serializeCategory(category) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/expense-categories error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to add category" },
      { status: 500 }
    );
  }
}
