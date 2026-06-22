import { Notification } from '../../models/notification.model.js';
import { emitToUser } from '../../utils/socket.js';
import * as dbFactory from '../../utils/dbFactory.js';
import { AppError } from '../../utils/appError.js';
import { NotificationQuery } from './notification.schema.js';

interface CreateNotificationInput {
  userId: string;
  type:
    | 'booking_request'
    | 'booking_accepted'
    | 'booking_declined'
    | 'booking_cancelled'
    | 'session_confirmed'
    | 'credits_released'
    | 'match_suggestion'
    | 'new_review'
    | 'new_message';
  title: string;
  body: string;
  relatedEntityId?: string;
  relatedEntityType?: 'Booking' | 'Match' | 'Review' | 'Message';
}

// All notification creation happens here — controllers/services never
// create Notification documents directly (see Badilni plan §6.7).
export const create = async (input: CreateNotificationInput) => {
  const notification = await Notification.create(input);

  emitToUser(input.userId, 'notification', notification.toJSON());

  return notification;
};

export const getMyNotifications = async (
  userId: string,
  query: NotificationQuery,
) => {
  const mongooseQuery = Notification.find({ userId });

  return dbFactory.findMany(mongooseQuery, query, []);
};

export const markAsRead = async (id: string, userId: string) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true },
    { returnDocument: 'after' },
  );

  if (!notification) {
    throw new AppError('No notification found with this id', 404);
  }

  return notification;
};

export const markAllAsRead = async (userId: string) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
};

export const getUnreadCount = async (userId: string) => {
  return Notification.countDocuments({ userId, isRead: false });
};
