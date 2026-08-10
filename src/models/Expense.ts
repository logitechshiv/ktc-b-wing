import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { EXPENSE_PAYMENT_METHODS } from "@/lib/expense-constants";

export { EXPENSE_PAYMENT_METHODS, type DbExpensePaymentMethod } from "@/lib/expense-constants";

const ExpenseSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    /** @deprecated legacy English title — kept for reading old records */
    expenseTitle: {
      type: String,
      default: "",
      trim: true,
    },
    /** Expense title in Gujarati (primary title field) */
    expenseTitleGujarati: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    displayOrder: {
      type: Number,
      required: true,
      min: 1,
      unique: true,
      sparse: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
      required: true,
      index: true,
    },
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    /** Vercel Blob URL (or legacy local path) — first document; kept for older clients */
    billImage: {
      type: String,
      default: "",
      trim: true,
    },
    /** Multiple bill / receipt documents (Vercel Blob URLs or legacy paths) */
    billImages: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    whatsappShared: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "expenses",
    strict: false,
  }
);

ExpenseSchema.index({ createdAt: -1 });

export type ExpenseDocument = InferSchemaType<typeof ExpenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IExpense = Model<ExpenseDocument>;

function getExpenseModel(): IExpense {
  if (models.Expense) {
    delete models.Expense;
  }
  try {
    mongoose.deleteModel("Expense");
  } catch {
    /* not registered */
  }
  return model<ExpenseDocument>("Expense", ExpenseSchema);
}

const Expense = getExpenseModel();

export default Expense;
