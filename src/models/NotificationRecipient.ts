import mongoose, { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user delivery + read state for a shared notification event.
 * One notification → many recipients; each user has their own isRead.
 */
const NotificationRecipientSchema = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    /** Denormalized from notification for sorted user feeds */
    createdAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "notification_recipients",
  }
);

NotificationRecipientSchema.index({ notificationId: 1, userId: 1 }, { unique: true });
NotificationRecipientSchema.index({ userId: 1, createdAt: -1 });
NotificationRecipientSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export type NotificationRecipientDocument = InferSchemaType<
  typeof NotificationRecipientSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export type INotificationRecipient = Model<NotificationRecipientDocument>;

const NotificationRecipient =
  (models.NotificationRecipient as INotificationRecipient) ||
  model<NotificationRecipientDocument>("NotificationRecipient", NotificationRecipientSchema);

export default NotificationRecipient;
