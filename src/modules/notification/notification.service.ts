import { Notification } from '../../models/notification.model.js';
import { emitToUser } from '../../socket/socket.js';
import { SOCKET_EVENTS } from '../../socket/socket.types.js';
import { AppError } from '../../utils/appError.js';
import {
  CreateNotificationParams,
  NotificationType,
} from './notification.types.js';

// Called by every other module — never throws to the caller
export const create = async (
  params: CreateNotificationParams,
): Promise<void> => {
  try {
    const notification = await Notification.create(params);

    emitToUser(params.userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      _id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      relatedId: notification.relatedId?.toString(),
      relatedType: notification.relatedType ?? undefined,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (err) {
    // Log but never propagate — a failed notification must not fail the caller
    console.error('[NotificationService] Failed to create notification:', err);
  }
};

export const getAll = async (
  userId: string,
  query: { page: number; limit: number; unreadOnly?: boolean },
) => {
  const filter: Record<string, unknown> = { userId };

  if (query.unreadOnly) {
    filter.isRead = false;
  }

  const skip = (query.page - 1) * query.limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
};

export const markAsRead = async (
  notificationId: string,
  userId: string,
): Promise<void> => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true },
  );

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
};

export const deleteOne = async (
  notificationId: string,
  userId: string,
): Promise<void> => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
};

// Convenience factories — used by other modules for consistent messaging
export const notifyBookingRequest = (params: {
  receiverId: string;
  providerName: string;
  bookingId: string;
}) =>
  create({
    userId: params.receiverId,
    type: NotificationType.BOOKING_REQUEST,
    title: 'New Booking Request',
    body: `${params.providerName} wants to fulfill your request.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingAccepted = (params: {
  receiverId: string;
  providerName: string;
  bookingId: string;
}) =>
  create({
    userId: params.receiverId,
    type: NotificationType.BOOKING_ACCEPTED,
    title: 'Booking Accepted',
    body: `${params.providerName} accepted your booking. Check the meeting link.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingDeclined = (params: {
  receiverId: string;
  providerName: string;
  bookingId: string;
}) =>
  create({
    userId: params.receiverId,
    type: NotificationType.BOOKING_DECLINED,
    title: 'Booking Declined',
    body: `${params.providerName} declined your booking request.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingCancelled = (params: {
  userId: string;
  cancelledByName: string;
  bookingId: string;
}) =>
  create({
    userId: params.userId,
    type: NotificationType.BOOKING_CANCELLED,
    title: 'Booking Cancelled',
    body: `Your booking was cancelled by ${params.cancelledByName}.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingCompleted = (params: {
  userId: string;
  bookingId: string;
}) =>
  create({
    userId: params.userId,
    type: NotificationType.BOOKING_COMPLETED,
    title: 'Session Completed',
    body: 'Your session has been marked as complete. Please leave a review.',
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyCreditsReleased = (params: {
  providerId: string;
  amount: number;
  bookingId: string;
}) =>
  create({
    userId: params.providerId,
    type: NotificationType.CREDITS_RELEASED,
    title: 'Credits Received',
    body: `${params.amount} Time Credits have been added to your wallet.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyCreditsRefunded = (params: {
  receiverId: string;
  amount: number;
  bookingId: string;
}) =>
  create({
    userId: params.receiverId,
    type: NotificationType.CREDITS_REFUNDED,
    title: 'Credits Refunded',
    body: `${params.amount} Time Credits have been returned to your wallet.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyNewReview = (params: {
  userId: string;
  reviewerName: string;
  reviewId: string;
}) =>
  create({
    userId: params.userId,
    type: NotificationType.NEW_REVIEW,
    title: 'New Review',
    body: `${params.reviewerName} left you a review.`,
    relatedId: params.reviewId,
    relatedType: 'Review',
  });

export const notifyAiMatch = (params: {
  userId: string;
  matchId: string;
  reason: string;
}) =>
  create({
    userId: params.userId,
    type: NotificationType.AI_MATCH,
    title: 'New Match Found',
    body: params.reason,
    relatedId: params.matchId,
    relatedType: 'Match',
  });
