import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const PaymentPurposeSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    amountPerFlat: {
      type: Number,
      required: true,
      min: 0,
    },
    /** sold = owner/renter flats only; all = sold + unsold/builder */
    collectionScope: {
      type: String,
      enum: ["sold", "all"],
      required: true,
      default: "sold",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "payment_purposes",
  }
);

export type PaymentPurposeDocument = InferSchemaType<typeof PaymentPurposeSchema> & {
  _id: mongoose.Types.ObjectId;
  /** Legacy field — prefer amountPerFlat */
  amount?: number;
};

export type IPaymentPurpose = Model<PaymentPurposeDocument>;

function getPaymentPurposeModel(): IPaymentPurpose {
  if (models.PaymentPurpose) {
    delete models.PaymentPurpose;
  }
  try {
    mongoose.deleteModel("PaymentPurpose");
  } catch {
    /* not registered yet */
  }
  return model<PaymentPurposeDocument>("PaymentPurpose", PaymentPurposeSchema);
}

const PaymentPurpose = getPaymentPurposeModel();

export default PaymentPurpose;
