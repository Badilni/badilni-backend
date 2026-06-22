import mongoose, { QueryFilter } from 'mongoose';

import { Booking, BookingDocument } from '../../models/booking.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import * as dbFactory from '../../utils/dbFactory.js';
import * as notificationService from '../notification/notification.service.js';
import {
  AcceptBookingInput,
  BookingQuery,
  CancelBookingInput,
  CreateBookingInput,
  DisputeBookingInput,
} from './booking.schema.js';

interface CurrentUser {
  id: string;
  role?: string;
}

const populateBooking = (query: ReturnType<typeof Booking.findById>) =>
  query
    .populate('receiverId', 'name avatar')
    .populate('providerId', 'name avatar')
    .populate('listingId', 'title hourlyRate')
    .populate('requestId', 'title creditsOffered');

const validateStateTransition = (
  booking: BookingDocument,
  allowedFrom: string[],
) => {
  if (!allowedFrom.includes(booking.status)) {
    throw new AppError(
      `Cannot perform this action while booking status is "${booking.status}"`,
      400,
    );
  }
};

export const createBooking = async (
  receiverId: string,
  data: CreateBookingInput,
) => {
  let booking: BookingDocument;

  if (data.listingId) {
    const listing = await SkillListing.findOne({
      _id: data.listingId,
      isActive: true,
    });

    if (!listing) {
      throw new AppError('No active skill listing found with this id', 404);
    }
    if (listing.user.toString() === receiverId) {
      throw new AppError('You cannot book your own listing', 400);
    }

    const creditsTotal = Math.round(listing.hourlyRate * data.durationHours);

    booking = await Booking.create({
      receiverId,
      providerId: listing.user,
      listingId: data.listingId,
      scheduledAt: data.scheduledAt,
      durationHours: data.durationHours,
      creditsTotal,
    });
  } else {
    const request = await ServiceRequest.findOne({
      _id: data.requestId,
      status: 'open',
    });

    if (!request) {
      throw new AppError('No open service request found with this id', 404);
    }
    if (request.user.toString() === receiverId) {
      throw new AppError('You cannot book your own request', 400);
    }

    // For a ServiceRequest, the requester pays credits and receives help —
    // the current authenticated user is offering to help, i.e. the provider.
    booking = await Booking.create({
      receiverId: request.user,
      providerId: receiverId,
      requestId: data.requestId,
      scheduledAt: data.scheduledAt,
      durationHours: data.durationHours,
      creditsTotal: request.creditsOffered,
    });
  }

  await notificationService.create({
    userId: booking.providerId.toString(),
    type: 'booking_request',
    title: 'New booking request',
    body: 'You have a new booking request awaiting your response.',
    relatedEntityId: booking._id.toString(),
    relatedEntityType: 'Booking',
  });

  return booking;
};

export const getBooking = async (
  id: string,
  user: CurrentUser,
  query: dbFactory.FieldSelectionOptions = {},
) => {
  const booking = await dbFactory.findDocumentOrThrow(
    populateBooking(Booking.findById(id)),
    query,
  );

  if (
    user.role !== 'admin' &&
    booking.receiverId._id.toString() !== user.id &&
    booking.providerId._id.toString() !== user.id
  ) {
    throw new AppError('You do not have access to this booking', 403);
  }

  return booking;
};

export const getAllBookings = async (
  user: CurrentUser,
  query: BookingQuery,
) => {
  const filter: QueryFilter<unknown> =
    user.role === 'admin'
      ? {}
      : { $or: [{ receiverId: user.id }, { providerId: user.id }] };

  const mongooseQuery = populateBooking(Booking.find(filter));

  return dbFactory.findMany(mongooseQuery, query, []);
};

export const acceptBooking = async (
  id: string,
  user: CurrentUser,
  data: AcceptBookingInput,
) => {
  const session = await mongoose.startSession();

  try {
    let booking: BookingDocument | null = null;

    await session.withTransaction(async () => {
      booking = await Booking.findById(id).session(session);

      if (!booking) {
        throw new AppError('No booking found with this id', 404);
      }
      if (booking.providerId.toString() !== user.id) {
        throw new AppError('Only the provider can accept this booking', 403);
      }

      validateStateTransition(booking, ['pending']);

      const receiver = await User.findOneAndUpdate(
        { _id: booking.receiverId, walletBalance: { $gte: booking.creditsTotal } },
        {
          $inc: {
            walletBalance: -booking.creditsTotal,
            creditsInEscrow: booking.creditsTotal,
          },
        },
        { session, returnDocument: 'after' },
      );

      if (!receiver) {
        throw new AppError('Receiver has insufficient credits', 400);
      }

      booking.status = 'accepted';
      booking.meetingLink = data.meetingLink;
      await booking.save({ session });
    });

    await notificationService.create({
      userId: booking!.receiverId.toString(),
      type: 'booking_accepted',
      title: 'Booking accepted',
      body: 'Your booking request has been accepted. Check the meeting link.',
      relatedEntityId: booking!._id.toString(),
      relatedEntityType: 'Booking',
    });

    return populateBooking(Booking.findById(booking!._id));
  } finally {
    session.endSession();
  }
};

export const declineBooking = async (id: string, user: CurrentUser) => {
  const booking = await Booking.findById(id);

  if (!booking) {
    throw new AppError('No booking found with this id', 404);
  }
  if (booking.providerId.toString() !== user.id) {
    throw new AppError('Only the provider can decline this booking', 403);
  }

  validateStateTransition(booking, ['pending']);

  booking.status = 'declined';
  await booking.save();

  await notificationService.create({
    userId: booking.receiverId.toString(),
    type: 'booking_declined',
    title: 'Booking declined',
    body: 'Your booking request has been declined by the provider.',
    relatedEntityId: booking._id.toString(),
    relatedEntityType: 'Booking',
  });

  return booking;
};

export const confirmBooking = async (id: string, user: CurrentUser) => {
  const session = await mongoose.startSession();

  try {
    let booking: BookingDocument | null = null;
    let justCompleted = false;

    await session.withTransaction(async () => {
      booking = await Booking.findById(id).session(session);

      if (!booking) {
        throw new AppError('No booking found with this id', 404);
      }

      const isReceiver = booking.receiverId.toString() === user.id;
      const isProvider = booking.providerId.toString() === user.id;

      if (!isReceiver && !isProvider) {
        throw new AppError('You are not a participant in this booking', 403);
      }

      validateStateTransition(booking, ['accepted']);

      if (isReceiver) {
        booking.receiverConfirmed = true;
      }
      if (isProvider) {
        booking.providerConfirmed = true;
      }

      if (booking.receiverConfirmed && booking.providerConfirmed) {
        await User.updateOne(
          { _id: booking.receiverId },
          { $inc: { creditsInEscrow: -booking.creditsTotal } },
          { session },
        );

        await User.updateOne(
          { _id: booking.providerId },
          {
            $inc: {
              walletBalance: booking.creditsTotal,
              totalSessionsCompleted: 1,
            },
          },
          { session },
        );

        await Transaction.create(
          [
            {
              fromUserId: booking.receiverId,
              toUserId: booking.providerId,
              amount: booking.creditsTotal,
              type: 'session_payment',
              bookingId: booking._id,
              description: 'Session payment released from escrow',
            },
          ],
          { session },
        );

        booking.status = 'completed';
        justCompleted = true;
      }

      await booking.save({ session });
    });

    if (justCompleted) {
      await Promise.all([
        notificationService.create({
          userId: booking!.receiverId.toString(),
          type: 'credits_released',
          title: 'Session completed',
          body: 'Your session is confirmed complete and credits have been released.',
          relatedEntityId: booking!._id.toString(),
          relatedEntityType: 'Booking',
        }),
        notificationService.create({
          userId: booking!.providerId.toString(),
          type: 'credits_released',
          title: 'Credits released',
          body: 'Your session is confirmed complete and credits have been added to your wallet.',
          relatedEntityId: booking!._id.toString(),
          relatedEntityType: 'Booking',
        }),
      ]);
    } else {
      await notificationService.create({
        userId:
          booking!.receiverId.toString() === user.id
            ? booking!.providerId.toString()
            : booking!.receiverId.toString(),
        type: 'session_confirmed',
        title: 'Session confirmation pending',
        body: 'The other participant confirmed the session. Please confirm to release credits.',
        relatedEntityId: booking!._id.toString(),
        relatedEntityType: 'Booking',
      });
    }

    return populateBooking(Booking.findById(booking!._id));
  } finally {
    session.endSession();
  }
};

export const cancelBooking = async (
  id: string,
  user: CurrentUser,
  data: CancelBookingInput,
) => {
  const session = await mongoose.startSession();

  try {
    let booking: BookingDocument | null = null;

    await session.withTransaction(async () => {
      booking = await Booking.findById(id).session(session);

      if (!booking) {
        throw new AppError('No booking found with this id', 404);
      }

      const isReceiver = booking.receiverId.toString() === user.id;
      const isProvider = booking.providerId.toString() === user.id;

      if (!isReceiver && !isProvider && user.role !== 'admin') {
        throw new AppError('You are not a participant in this booking', 403);
      }

      validateStateTransition(booking, ['pending', 'accepted']);

      if (booking.status === 'accepted') {
        await User.updateOne(
          { _id: booking.receiverId },
          {
            $inc: {
              creditsInEscrow: -booking.creditsTotal,
              walletBalance: booking.creditsTotal,
            },
          },
          { session },
        );

        await Transaction.create(
          [
            {
              fromUserId: null,
              toUserId: booking.receiverId,
              amount: booking.creditsTotal,
              type: 'refund',
              bookingId: booking._id,
              description: 'Refund for cancelled booking',
            },
          ],
          { session },
        );
      }

      booking.status = 'cancelled';
      booking.cancelledBy = new mongoose.Types.ObjectId(user.id);
      booking.cancellationReason = data.cancellationReason;
      await booking.save({ session });
    });

    const otherPartyId =
      booking!.receiverId.toString() === user.id
        ? booking!.providerId.toString()
        : booking!.receiverId.toString();

    await notificationService.create({
      userId: otherPartyId,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      body: 'A booking you were part of has been cancelled.',
      relatedEntityId: booking!._id.toString(),
      relatedEntityType: 'Booking',
    });

    return populateBooking(Booking.findById(booking!._id));
  } finally {
    session.endSession();
  }
};

// Either party can flag a completed/accepted session as problematic;
// an admin then reviews it manually (see Badilni plan §1.3 Dispute Filing).
export const disputeBooking = async (
  id: string,
  user: CurrentUser,
  data: DisputeBookingInput,
) => {
  const booking = await Booking.findById(id);

  if (!booking) {
    throw new AppError('No booking found with this id', 404);
  }

  const isReceiver = booking.receiverId.toString() === user.id;
  const isProvider = booking.providerId.toString() === user.id;

  if (!isReceiver && !isProvider) {
    throw new AppError('You are not a participant in this booking', 403);
  }

  validateStateTransition(booking, ['accepted', 'completed']);

  booking.status = 'disputed';
  booking.cancellationReason = data.reason;
  await booking.save();

  return booking;
};

// Auto-resolves bookings stuck in "accepted" past their session window
// without both confirmations, favouring the provider (see plan §6.3).
export const autoResolveStaleBookings = async () => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleBookings = await Booking.find({
    status: 'accepted',
    $expr: {
      $lt: [
        { $add: ['$scheduledAt', { $multiply: ['$durationHours', 60 * 60 * 1000] }] },
        cutoff,
      ],
    },
  });

  for (const booking of staleBookings) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await User.updateOne(
          { _id: booking.receiverId },
          { $inc: { creditsInEscrow: -booking.creditsTotal } },
          { session },
        );
        await User.updateOne(
          { _id: booking.providerId },
          {
            $inc: {
              walletBalance: booking.creditsTotal,
              totalSessionsCompleted: 1,
            },
          },
          { session },
        );
        await Transaction.create(
          [
            {
              fromUserId: booking.receiverId,
              toUserId: booking.providerId,
              amount: booking.creditsTotal,
              type: 'session_payment',
              bookingId: booking._id,
              description: 'Auto-resolved: unconfirmed session past 48h window',
            },
          ],
          { session },
        );

        booking.status = 'completed';
        booking.receiverConfirmed = true;
        booking.providerConfirmed = true;
        await booking.save({ session });
      });
    } finally {
      session.endSession();
    }
  }

  return staleBookings.length;
};
