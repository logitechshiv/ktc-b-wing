import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const NoticeSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
    collection: "notices",
  }
);

NoticeSchema.index({ createdAt: -1 });

export type NoticeDocument = InferSchemaType<typeof NoticeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type INotice = Model<NoticeDocument>;

function getNoticeModel(): INotice {
  if (models.Notice) {
    delete models.Notice;
  }
  try {
    mongoose.deleteModel("Notice");
  } catch {
    /* not registered */
  }
  return model<NoticeDocument>("Notice", NoticeSchema);
}

const Notice = getNoticeModel();

export default Notice;
