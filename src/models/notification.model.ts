import mongoose, { InferSchemaType } from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A notification must belong to a user'],
    },
    type: {
      type: String,
      enum: [
        'booking_request',
        'booking_accepted',
        'booking_declined',
        'booking_cancelled',
        'session_confirmed',
        'credits_released',
        'match_suggestion',
        'new_review',
        'new_message',
      ],
      required: [true, 'Please provide a notification type'],
    },
    title: {
      type: String,
      required: [true, 'Please provide a notification title'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Please provide a notification body'],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedEntityType: {
      type: String,
      enum: ['Booking', 'Match', 'Review', 'Message'],
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const sanitizeNotificationOutput = (ret: Record<string, any>) => {
  delete ret.__v;
  return ret;
};

notificationSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeNotificationOutput(ret),
});

notificationSchema.set('toObject', {
  virtuals: true,
});

export type INotification = InferSchemaType<typeof notificationSchema>;

export const Notification = mongoose.model('Notification', notificationSchema);

export type NotificationDocument = InstanceType<typeof Notification>;