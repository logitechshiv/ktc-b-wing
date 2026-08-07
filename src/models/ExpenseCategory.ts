import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const ExpenseCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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
