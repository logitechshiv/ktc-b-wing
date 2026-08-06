import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export const PAYMENT_MODES = ["cash", "bank", "upi"] as const;
export type DbPaymentMode = (typeof PAYMENT_MODES)[number];

const PaymentSchema = new Schema(
  {
    flatId: {
      type: Schema.Types.ObjectId,
      ref: "Flat",
      required: true,
      index: true,
    },
    floorNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 13,
      index: true,
    },
    flatNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    paymentPurposeId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentPurpose",
      required: true,
      index: true,
    },
    paymentPurpose: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      required: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      index: true,
    },
    whatsappSent: {
      type: Boolean,
      default: false,
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
    collection: "payments",
  }
);

PaymentSchema.index({ paymentPurposeId: 1, flatNumber: 1 });

export type PaymentDocument = InferSchemaType<typeof PaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IPayment = Model<PaymentDocument>;

function getPaymentModel(): IPayment {
  if (models.Payment) {
    delete models.Payment;
  }
  try {
    mongoose.deleteModel("Payment");
  } catch {
    /* not registered yet */
  }
  return model<PaymentDocument>("Payment", PaymentSchema);
}

const Payment = getPaymentModel();

export default Payment;
