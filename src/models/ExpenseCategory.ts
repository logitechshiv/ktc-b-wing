import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { EXPENSE_CATEGORY_ROLES } from "@/lib/expense-category-role";

const ExpenseCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    /** When true, expenses in this category count toward Monthly Common Expense Split */
    includeInCommonExpense: {
      type: Boolean,
      default: false,
      index: true,
    },
    /**
     * KIRAN 3 Common balance role (independent of includeInCommonExpense):
     * normal | common_credit (+) | common_debit (-)
     */
    role: {
      type: String,
      enum: EXPENSE_CATEGORY_ROLES,
      default: "normal",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "expense_categories",
  }
);

export type ExpenseCategoryDocument = InferSchemaType<typeof ExpenseCategorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IExpenseCategory = Model<ExpenseCategoryDocument>;

function getExpenseCategoryModel(): IExpenseCategory {
  if (models.ExpenseCategory) {
    delete models.ExpenseCategory;
  }
  try {
    mongoose.deleteModel("ExpenseCategory");
  } catch {
    /* not registered */
  }
  return model<ExpenseCategoryDocument>("ExpenseCategory", ExpenseCategorySchema);
}

const ExpenseCategory = getExpenseCategoryModel();

export default ExpenseCategory;
