import { Notification } from '../../models/notification.model.js';
import { User } from '../../models/user.model.js';
import { emitToAll, emitToUser } from '../../socket/socket.js';
import { SOCKET_EVENTS } from '../../socket/socket.types.js';
import { AppError } from '../../utils/appError.js';
import {
  CreateNotificationParams,
  NotificationType,
} from './notification.types.js';
import { AdminSendNotificationInput } from './notification.schema.js';

// Called by every other module - never throws to the caller
export const create = async (
  params: CreateNotificationParams,
): Promise<void> => {
  try {
    const notification = await Notification.create(params);

    emitToUser(params.user, SOCKET_EVENTS.NOTIFICATION_NEW, {
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
    // Log but never propagate - a failed notification must not fail the caller
    console.error('[NotificationService] Failed to create notification:', err);
  }
};

export const getAll = async (
  userId: string,
  query: { page: number; limit: number; unreadOnly?: boolean },
) => {
  const filter: Record<string, unknown> = { user: userId };

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
    Notification.countDocuments({ user: userId, isRead: false }),
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
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true },
  );

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true },
  );
};

export const deleteOne = async (
  notificationId: string,
  userId: string,
): Promise<void> => {
  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
};

// Admin - broadcast / announcement

// Unlike `create()`, this is admin-initiated and should surface failures to
// the caller so a failed send is visible in the admin UI instead of being
// silently swallowed.
export const sendAdminNotification = async (
  data: AdminSendNotificationInput,
) => {
  const BATCH_SIZE = 1_000;

  const baseDoc = {
    type: NotificationType.ADMIN_ANNOUNCEMENT,
    title: data.title,
    body: data.message,
  };

  // Single-user path
  if (data.target === 'user') {
    const user = await User.findById(data.userId);
    if (!user) {
      throw new AppError('No user found with this id', 404);
    }

    const [notification] = await Notification.insertMany([
      { user: data.userId, ...baseDoc },
    ]);

    emitToUser(data.userId!, SOCKET_EVENTS.NOTIFICATION_NEW, {
      _id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    });

    return { count: 1, notification };
  }

  // Broadcast path
  // Stream user IDs via a cursor so we never load the full user collection
  // into Node.js memory at once.  Manual batching keeps peak heap usage low:
  // at any moment only BATCH_SIZE notification objects exist in RAM, not N
  // (where N could be hundreds of thousands of users).
  const cursor = User.find({ active: { $ne: false } })
    .select('_id')
    .lean()
    .cursor();

  let batch: object[] = [];
  let totalInserted = 0;

  for await (const user of cursor) {
    batch.push({ user: user._id, ...baseDoc });

    if (batch.length === BATCH_SIZE) {
      await Notification.insertMany(batch);
      totalInserted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await Notification.insertMany(batch);
    totalInserted += batch.length;
  }

  if (totalInserted === 0) {
    return { count: 0, notification: null };
  }

  // Single broadcast to all connected clients — no per-user loop needed.
  emitToAll(SOCKET_EVENTS.NOTIFICATION_NEW, {
    type: baseDoc.type,
    title: baseDoc.title,
    body: baseDoc.body,
    isRead: false,
    createdAt: new Date().toISOString(),
  });

  return { count: totalInserted, notification: null };
};

// Convenience factories - used by other modules for consistent messaging
//
// Naming convention: every factory takes `recipientId` - whoever the
// notification is FOR. Never named `providerId`/`receiverId` unless the
// recipient is *always* that specific booking role regardless of which
// flow (SkillListing vs ServiceRequest) created the booking. Booking-request
// lifecycle events (request/accepted/declined) can target either role
// depending on flow, so they take an explicit `isFulfillingRequest` flag
// instead of assuming a fixed direction.

export const notifyBookingRequest = (params: {
  recipientId: string;
  actorName: string;
  bookingId: string;
  isFulfillingRequest: boolean; // true = caller is fulfilling a ServiceRequest, false = caller booked a SkillListing
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.BOOKING_REQUEST,
    title: params.isFulfillingRequest
      ? 'Someone Wants to Fulfill Your Request'
      : 'New Booking Request',
    body: params.isFulfillingRequest
      ? `${params.actorName} wants to fulfill your service request.`
      : `${params.actorName} wants to book your listing.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingAccepted = (params: {
  recipientId: string;
  actorName: string;
  bookingId: string;
  isFulfillingRequest: boolean;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.BOOKING_ACCEPTED,
    title: 'Booking Accepted',
    body: params.isFulfillingRequest
      ? `${params.actorName} accepted your offer to fulfill their request.`
      : `${params.actorName} accepted your booking. Check the meeting link.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingDeclined = (params: {
  recipientId: string;
  actorName: string;
  bookingId: string;
  isFulfillingRequest: boolean;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.BOOKING_DECLINED,
    title: 'Booking Declined',
    body: params.isFulfillingRequest
      ? `${params.actorName} declined your offer to fulfill their request.`
      : `${params.actorName} declined your booking request.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingCancelled = (params: {
  recipientId: string;
  cancelledByName: string;
  bookingId: string;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.BOOKING_CANCELLED,
    title: 'Booking Cancelled',
    body: `Your booking was cancelled by ${params.cancelledByName}.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyBookingCompleted = (params: {
  recipientId: string;
  bookingId: string;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.BOOKING_COMPLETED,
    title: 'Session Completed',
    body: 'Your session has been marked as complete. Please leave a review.',
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyDisputeFiled = (params: {
  recipientId: string;
  filedByName: string;
  bookingId: string;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.DISPUTE_FILED,
    title: 'Dispute Filed',
    body: `${params.filedByName} has filed a dispute for your session. An admin will review it shortly.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyDisputeResolved = (params: {
  recipientId: string;
  bookingId: string;
  // The message body is caller-constructed so each party gets a tailored
  // description of what happened to their credits.
  body: string;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.DISPUTE_RESOLVED,
    title: 'Dispute Resolved',
    body: params.body,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

export const notifyMeetingLinkAdded = (params: {
  recipientId: string;
  providerName: string;
  bookingId: string;
}) =>
  create({
    user: params.recipientId,
    type: NotificationType.MEETING_LINK_ADDED,
    title: 'Meeting Link Added',
    body: `${params.providerName} has added a meeting link to your booking.`,
    relatedId: params.bookingId,
    relatedType: 'Booking',
  });

// Credit notifications below keep providerId/receiverId naming deliberately —
// CREDITS_RELEASED always goes to whoever is booking.provider, and
// CREDITS_REFUNDED always goes to whoever is booking.receiver, regardless of
// which flow created the booking. These are tied to escrow mechanics (the
// receiver is always the one whose wallet holds escrow), not to who initiated.

export const notifyCreditsReleased = (params: {
  providerId: string;
  amount: number;
  bookingId: string;
}) =>
  create({
    user: params.providerId,
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
    user: params.receiverId,
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
    user: params.userId,
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
    user: params.userId,
    type: NotificationType.AI_MATCH,
    title: 'New Match Found',
    body: params.reason,
    relatedId: params.matchId,
    relatedType: 'Match',
  });

export const notifyWelcomeBonus = (params: {
  userId: string;
  amount: number;
}) =>
  create({
    user: params.userId,
    type: NotificationType.CREDITS_WELCOME_BONUS,
    title: 'Welcome Bonus',
    body: `${params.amount} Time Credits have been added to your wallet. Start exchanging skills!`,
  });

export const notifyAdminAdjustment = (params: {
  userId: string;
  amount: number;
  description: string;
}) => {
  const isCredit = params.amount > 0;
  const absAmount = Math.abs(params.amount);

  return create({
    user: params.userId,
    type: NotificationType.CREDITS_ADMIN_ADJUSTMENT,
    title: isCredit ? 'Credits Added' : 'Credits Deducted',
    body: isCredit
      ? `${absAmount} Time Credits have been added to your wallet. Reason: ${params.description}`
      : `${absAmount} Time Credits have been deducted from your wallet. Reason: ${params.description}`,
    relatedId: undefined,
    relatedType: undefined,
  });
};
