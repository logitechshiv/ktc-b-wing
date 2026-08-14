import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

/**
 * Builder payment against Monthly Common Expense Split (Builder Share).
 * Separate from purpose-based BuilderPayment / Payment rows.
 */
const BuilderCommonCollectionSchema = new Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1970,
      max: 2100,
      index: true,
    },
    expenseCategory: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "builder_common_collections",
  }
);

BuilderCommonCollectionSchema.index({ year: 1, month: 1 });
BuilderCommonCollectionSchema.index({ year: 1, month: 1, expenseCategory: 1 });

export type BuilderCommonCollectionDocument = InferSchemaType<
  typeof BuilderCommonCollectionSchema
> & {
  _id: mongoose.Types.ObjectId;
  paymentMode: DbPaymentMode;
};

export type IBuilderCommonCollection = Model<BuilderCommonCollectionDocument>;

function getBuilderCommonCollectionModel(): IBuilderCommonCollection {
  if (models.BuilderCommonCollection) {
    delete models.BuilderCommonCollection;
  }
  try {
    mongoose.deleteModel("BuilderCommonCollection");
  } catch {
    /* not registered yet */
  }
  return model<BuilderCommonCollectionDocument>(
    "BuilderCommonCollection",
    BuilderCommonCollectionSchema
  );
}

const BuilderCommonCollection = getBuilderCommonCollectionModel();

export default BuilderCommonCollection;
