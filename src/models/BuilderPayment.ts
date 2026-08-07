import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { PAYMENT_MODES, type DbPaymentMode } from "@/models/Payment";

/**
 * One builder batch payment per purpose — records the unsold-flats lump sum
 * before per-flat payment rows are generated.
 */
const BuilderPaymentSchema = new Schema(
  {
    paymentPurposeId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentPurpose",
      required: true,
      unique: true,
      index: true,
    },
    paymentPurpose: {
      type: String,
      required: true,
      trim: true,
    },
    builderName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPerFlat: {
      type: Number,
      required: true,
      min: 0,
    },
    flatCount: {
      type: Number,
      required: true,
      min: 1,
    },
    flatNumbers: {
      type: [String],
      default: [],
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
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
    collection: "builder_payments",
  }
);

export type BuilderPaymentDocument = InferSchemaType<typeof BuilderPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
  paymentMode: DbPaymentMode;
};

export type IBuilderPayment = Model<BuilderPaymentDocument>;

function getBuilderPaymentModel(): IBuilderPayment {
  if (models.BuilderPayment) {
    delete models.BuilderPayment;
  }
  try {
    mongoose.deleteModel("BuilderPayment");
  } catch {
    /* not registered yet */
  }
  return model<BuilderPaymentDocument>("BuilderPayment", BuilderPaymentSchema);
}

const BuilderPayment = getBuilderPaymentModel();

export default BuilderPayment;
