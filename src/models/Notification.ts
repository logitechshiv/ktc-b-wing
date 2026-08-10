import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export const NOTIFICATION_TYPES = [
  "FLAT_ADDED",
  "FLAT_UPDATED",
  "COLLECTION_ADDED",
  "EXPENSE_ADDED",
  "NOTICE_CREATED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RELATED_TYPES = [
  "flat",
  "payment",
  "expense",
  "notice",
  "builder_payment",
  "vehicle",
] as const;
export type NotificationRelatedType = (typeof RELATED_TYPES)[number];

const NotificationSchema = new Schema(
  {
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedId: {
      type: String,
      default: null,
      index: true,
    },
    relatedType: {
      type: String,
      default: null,
    },
    /** Stable key to prevent duplicate event notifications */
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

NotificationSchema.index({ createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof NotificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type INotification = Model<NotificationDocument>;

const Notification =
  (models.Notification as INotification) ||
  model<NotificationDocument>("Notification", NotificationSchema);

export default Notification;
