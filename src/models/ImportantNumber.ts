import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const ImportantNumberSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    area: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
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
    collection: "important_numbers",
  }
);

ImportantNumberSchema.index({ displayOrder: 1, createdAt: -1 });

export type ImportantNumberDocument = InferSchemaType<typeof ImportantNumberSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type IImportantNumber = Model<ImportantNumberDocument>;

function getImportantNumberModel(): IImportantNumber {
  if (models.ImportantNumber) {
    delete models.ImportantNumber;
  }
  try {
    mongoose.deleteModel("ImportantNumber");
  } catch {
    /* not registered */
  }
  return model<ImportantNumberDocument>("ImportantNumber", ImportantNumberSchema);
}

const ImportantNumber = getImportantNumberModel();

export default ImportantNumber;
