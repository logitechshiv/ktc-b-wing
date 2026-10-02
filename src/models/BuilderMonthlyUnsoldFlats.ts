import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

/** Authoritative Builder unsold-flat count for one Common Expense month. */
const BuilderMonthlyUnsoldFlatsSchema = new Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 1970, max: 2100 },
    unsoldFlats: { type: Number, required: true, min: 0, max: 52 },
  },
  { timestamps: true, collection: "builder_monthly_unsold_flats" }
);

BuilderMonthlyUnsoldFlatsSchema.index({ year: 1, month: 1 }, { unique: true });

export type BuilderMonthlyUnsoldFlatsDocument = InferSchemaType<
  typeof BuilderMonthlyUnsoldFlatsSchema
> & { _id: mongoose.Types.ObjectId };

export type IBuilderMonthlyUnsoldFlats = Model<BuilderMonthlyUnsoldFlatsDocument>;

function getBuilderMonthlyUnsoldFlatsModel(): IBuilderMonthlyUnsoldFlats {
  if (models.BuilderMonthlyUnsoldFlats) delete models.BuilderMonthlyUnsoldFlats;
  try {
    mongoose.deleteModel("BuilderMonthlyUnsoldFlats");
  } catch {
    /* not registered yet */
  }
  return model<BuilderMonthlyUnsoldFlatsDocument>(
    "BuilderMonthlyUnsoldFlats",
    BuilderMonthlyUnsoldFlatsSchema
  );
}

export default getBuilderMonthlyUnsoldFlatsModel();
