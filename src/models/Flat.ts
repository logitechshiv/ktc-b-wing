import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export const FLAT_STATUSES = ["available", "sold", "rent"] as const;
export type FlatStatus = (typeof FLAT_STATUSES)[number];

const FlatSchema = new Schema(
  {
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
      unique: true,
      trim: true,
    },
    /** Owner name in Gujarati (only name field) */
    ownerName: {
      type: String,
      default: "",
      trim: true,
    },
    ownerMobile: {
      type: String,
      default: "",
      trim: true,
    },
    /** Renter name in Gujarati (only name field) */
    renterName: {
      type: String,
      default: "",
      trim: true,
    },
    renterMobile: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: FLAT_STATUSES,
      default: "available",
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "flats",
  }
);

/** Compound index for floor grouping queries (flatNumber already unique alone). */
FlatSchema.index({ floorNumber: 1, flatNumber: 1 });

export type FlatDocument = InferSchemaType<typeof FlatSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IFlat = Model<FlatDocument>;

/** Hot-reload safe model bootstrap so schema field removals apply. */
function getFlatModel(): IFlat {
  if (models.Flat) {
    delete models.Flat;
  }
  try {
    mongoose.deleteModel("Flat");
  } catch {
    /* model may not exist yet */
  }
  return model<FlatDocument>("Flat", FlatSchema);
}

const Flat = getFlatModel();

export default Flat;
