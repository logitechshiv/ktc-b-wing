import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export const VEHICLE_TYPES = ["car", "bike", "auto"] as const;
export type DbVehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_OWNER_TYPES = ["owner", "renter"] as const;
export type DbVehicleOwnerType = (typeof VEHICLE_OWNER_TYPES)[number];

const VehicleSchema = new Schema(
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
      trim: true,
      index: true,
    },
    /** Linked flat from flats collection (source of truth for contact) */
    flatId: {
      type: Schema.Types.ObjectId,
      ref: "Flat",
      default: null,
      index: true,
    },
    /** Whether this vehicle belongs to the flat owner or renter */
    vehicleOwnerType: {
      type: String,
      enum: VEHICLE_OWNER_TYPES,
      default: "owner",
      index: true,
    },
    ownerName: {
      type: String,
      default: "",
      trim: true,
    },
    ownerMobile: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      required: true,
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    stickerIssued: {
      type: Boolean,
      default: false,
      index: true,
    },
    stickerNumber: {
      type: String,
      default: "",
      trim: true,
    },
    color: {
      type: String,
      default: "",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    model: {
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
    collection: "vehicles",
  }
);

VehicleSchema.index({ floorNumber: 1, flatNumber: 1 });

export type VehicleDocument = InferSchemaType<typeof VehicleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IVehicle = Model<VehicleDocument>;

/**
 * Hot-reload safe model bootstrap.
 * Next.js caches Mongoose models; delete + recreate so schema updates apply.
 */
function getVehicleModel(): IVehicle {
  if (models.Vehicle) {
    delete models.Vehicle;
  }
  try {
    mongoose.deleteModel("Vehicle");
  } catch {
    /* model may not exist yet */
  }
  return model<VehicleDocument>("Vehicle", VehicleSchema);
}

const Vehicle = getVehicleModel();

export default Vehicle;
