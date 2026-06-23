import mongoose, { InferSchemaType, Types } from 'mongoose';
import {
  NotificationType,
  RelatedEntityType,
} from '../modules/notification/notification.types.js';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must belong to a user'],
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: [true, 'Notification must have a type'],
    },
    title: {
      type: String,
      required: [true, 'Notification must have a title'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Notification must have a body'],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedId: {
      type: Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      enum: [
        'Booking',
        'SkillListing',
        'ServiceRequest',
        'Review',
        'Match',
      ] satisfies RelatedEntityType[],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Main query — unread notifications for a user sorted by newest
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Full history query
notificationSchema.index({ userId: 1, createdAt: -1 });

// Auto-delete read notifications after 30 days
notificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { isRead: true },
  },
);

export type INotification = InferSchemaType<typeof notificationSchema>;
export const Notification = mongoose.model('Notification', notificationSchema);
export type NotificationDocument = InstanceType<typeof Notification>;
