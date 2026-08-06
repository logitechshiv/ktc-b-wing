import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import {
  EXPENSE_METHODS,
  EXPENSE_PAYMENT_METHODS,
} from "@/lib/expense-constants";

export {
  EXPENSE_METHODS,
  EXPENSE_PAYMENT_METHODS,
  DEFAULT_EXPENSE_CATEGORIES,
  type DbExpenseMethod,
  type DbExpensePaymentMethod,
} from "@/lib/expense-constants";

const ExpenseSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    expenseTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
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
    expenseMethod: {
      type: String,
      enum: EXPENSE_METHODS,
      required: true,
      index: true,
    },
    collectionPurposeId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentPurpose",
      default: null,
    },
    collectionPurposeName: {
      type: String,
      default: "",
      trim: true,
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
    billImage: {
      type: String,
      default: "",
      trim: true,
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
  }
);

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
