import mongoose from 'mongoose';
import { Booking, BookingDocument } from '../../models/booking.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import { uploadImage } from '../../utils/cloudinary.js';
import {
  lockEscrow,
  releaseEscrow,
  refundEscrow,
} from '../transaction/transaction.service.js';

import {
  notifyBookingRequest,
  notifyBookingAccepted,
  notifyBookingDeclined,
  notifyBookingCancelled,
  notifyBookingCompleted,
  notifyDisputeFiled,
  notifyMeetingLinkAdded,
  notifyCreditsReleased,
  notifyCreditsRefunded,
} from '../notification/notification.service.js';

import { BookingStatus } from './booking.types.js';
import {
  CreateBookingInput,
  CancelBookingInput,
  AddMeetingLinkInput,
  BookingQueryInput,
} from './booking.schema.js';

// Helpers

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.ACCEPTED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.ACCEPTED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.DECLINED]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.DISPUTED]: [],
  [BookingStatus.CANCELLED]: [],
};

// Used only for a fast, friendly pre-check before attempting the atomic
// conditional update. It is NOT the actual race guard - the conditional
// `findOneAndUpdate` filter below is. If a real race occurs (status changes
// between this check and the atomic update), the atomic update's null-check
// is what actually catches it, just with a more generic error.
const validateTransition = (
  current: BookingStatus,
  next: BookingStatus,
): void => {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new AppError(
      `Cannot transition booking from '${current}' to '${next}'`,
      400,
    );
  }
};

// Create

export const createBooking = async (
  initiatorId: string,
  data: CreateBookingInput,
  files?: Express.Multer.File[],
) => {
  const {
    listing: listingId,
    request: requestId,
    scheduledAt,
    durationHours,
    note,
  } = data;

  let providerId: string;
  let receiverId: string;
  let creditsTotal: number;
  let notifyUserId: string;

  if (listingId) {
    // SkillListing flow
    const listing = await SkillListing.findById(listingId);
    if (!listing) {
      throw new AppError('Skill listing not found', 404);
    }
    if (!listing.isActive) {
      throw new AppError('This listing is no longer active', 400);
    }
    if (listing.user.toString() === initiatorId) {
      throw new AppError('You cannot book your own listing', 400);
    }

    providerId = listing.user.toString();
    receiverId = initiatorId;
    creditsTotal = listing.hourlyRate * durationHours;
    notifyUserId = providerId;
  } else {
    // ServiceRequest flow
    const request = await ServiceRequest.findById(requestId);
    if (!request) {
      throw new AppError('Service request not found', 404);
    }
    if (request.status !== 'open') {
      throw new AppError('This service request is no longer open', 400);
    }
    if (request.user.toString() === initiatorId) {
      throw new AppError('You cannot fulfill your own service request', 400);
    }

    providerId = initiatorId;
    receiverId = request.user.toString();
    creditsTotal = request.creditsOffered;
    notifyUserId = receiverId;
  }

  // In the listing flow, receiverId === initiatorId - fetch once with both
  // fields needed (balance check + notification name) instead of querying
  // the same document twice.
  const receiver = await User.findById(receiverId).select('name walletBalance');
  if (!receiver) {
    throw new AppError('Receiver not found', 404);
  }
  if (receiver.walletBalance < creditsTotal) {
    throw new AppError(
      'Insufficient wallet balance to create this booking',
      400,
    );
  }

  // Upload attachments if provided
  const attachments: { url: string; publicId: string }[] = [];
  if (files?.length) {
    if (files.length > 3) {
      throw new AppError('Maximum 3 attachments allowed', 400);
    }
    for (const file of files) {
      const result = await uploadImage(file, 'booking-attachments');
      attachments.push({ url: result.secure_url, publicId: result.public_id });
    }
  }

  const booking = await Booking.create({
    provider: providerId,
    receiver: receiverId,
    scheduledAt: new Date(scheduledAt),
    durationHours,
    creditsTotal,
    status: BookingStatus.PENDING,
    ...(listingId && { listing: listingId }),
    ...(requestId && { request: requestId }),
    ...(note && { note }),
    ...(attachments.length > 0 && { attachments }),
  });

  // initiator name: listing flow → initiator === receiver, reuse the fetch
  // above. request flow → initiator is a different user, fetch fresh.
  const initiatorName = listingId
    ? receiver.name
    : ((await User.findById(initiatorId).select('name'))?.name ?? 'Someone');

  notifyBookingRequest({
    recipientId: notifyUserId,
    actorName: initiatorName,
    bookingId: booking._id.toString(),
    isFulfillingRequest: !listingId,
  });

  return booking;
};

// Accept

export const acceptBooking = async (bookingId: string, userId: string) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }

  // eslint-disable-next-line eqeqeq
  const isListingBooking = existing.listing != null;
  const expectedAcceptor = isListingBooking
    ? existing.provider.toString()
    : existing.receiver.toString();

  if (expectedAcceptor !== userId) {
    throw new AppError('You are not authorized to accept this booking', 403);
  }

  validateTransition(existing.status as BookingStatus, BookingStatus.ACCEPTED);

  const session = await mongoose.startSession();
  let booking: BookingDocument | null = null;
  try {
    await session.withTransaction(async () => {
      // Atomic conditional transition - only succeeds if status is still
      // PENDING at write time. Guards against double-accept races (e.g.
      // a write-conflict retry, or a double-submitted request).
      booking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: BookingStatus.PENDING },
        { $set: { status: BookingStatus.ACCEPTED } },
        { session, returnDocument: 'after' },
      );
      if (!booking) {
        throw new AppError('Booking is no longer pending', 409);
      }

      // lockEscrow performs its own atomic balance check + decrement
      // it is the actual source of truth on sufficient balance, not a pre-check here.
      await lockEscrow(
        bookingId,
        booking.receiver.toString(),
        booking.creditsTotal,
        session,
      );
    });
  } finally {
    session.endSession();
  }

  const acceptor = await User.findById(userId).select('name');
  const notifyUserId = isListingBooking
    ? booking!.receiver.toString()
    : booking!.provider.toString();

  notifyBookingAccepted({
    recipientId: notifyUserId,
    actorName: acceptor?.name ?? 'Someone',
    bookingId,
    isFulfillingRequest: !isListingBooking,
  });

  return booking;
};

// Decline

export const declineBooking = async (bookingId: string, userId: string) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }

  // eslint-disable-next-line eqeqeq
  const isListingBooking = existing.listing != null;
  const expectedDecliner = isListingBooking
    ? existing.provider.toString()
    : existing.receiver.toString();

  if (expectedDecliner !== userId) {
    throw new AppError('You are not authorized to decline this booking', 403);
  }

  validateTransition(existing.status as BookingStatus, BookingStatus.DECLINED);

  // No money moves on decline - a plain atomic conditional update is enough,
  // no session/transaction needed.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BookingStatus.PENDING },
    { $set: { status: BookingStatus.DECLINED } },
    { returnDocument: 'after' },
  );
  if (!booking) {
    throw new AppError('Booking is no longer pending', 409);
  }

  const decliner = await User.findById(userId).select('name');
  const notifyUserId = isListingBooking
    ? booking.receiver.toString()
    : booking.provider.toString();

  notifyBookingDeclined({
    recipientId: notifyUserId,
    actorName: decliner?.name ?? 'Someone',
    bookingId,
    isFulfillingRequest: !isListingBooking,
  });

  return booking;
};

// Cancel

export const cancelBooking = async (
  bookingId: string,
  userId: string,
  data: CancelBookingInput,
) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }

  const isProvider = existing.provider.toString() === userId;
  const isReceiver = existing.receiver.toString() === userId;
  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  validateTransition(existing.status as BookingStatus, BookingStatus.CANCELLED);

  const otherPartyId = isProvider
    ? existing.receiver.toString()
    : existing.provider.toString();

  const setFields: Record<string, unknown> = {
    status: BookingStatus.CANCELLED,
    cancelledBy: new mongoose.Types.ObjectId(userId),
  };
  if (data.cancellationReason) {
    setFields.cancellationReason = data.cancellationReason;
  }

  let booking: typeof existing | null = null;
  let wasAccepted = false;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Atomic conditional transition - only PENDING/ACCEPTED can be
      // cancelled. `returnDocument: 'before'` returns the pre-update document, so we know
      // whether escrow needs refunding without a second read, and without
      // relying on a stale pre-fetched object.
      const before = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: [BookingStatus.PENDING, BookingStatus.ACCEPTED] },
        },
        { $set: setFields },
        { session, returnDocument: 'before' },
      );
      if (!before) {
        throw new AppError(
          'Booking cannot be cancelled in its current state',
          409,
        );
      }

      wasAccepted = before.status === BookingStatus.ACCEPTED;
      booking = before;

      if (wasAccepted) {
        await refundEscrow(
          bookingId,
          before.receiver.toString(),
          before.creditsTotal,
          session,
        );
      }
    });
  } finally {
    session.endSession();
  }

  const canceller = await User.findById(userId).select('name');

  notifyBookingCancelled({
    recipientId: otherPartyId,
    cancelledByName: canceller?.name ?? 'the other party',
    bookingId,
  });

  if (wasAccepted) {
    notifyCreditsRefunded({
      receiverId: booking!.receiver.toString(),
      amount: booking!.creditsTotal,
      bookingId,
    });
  }

  return booking;
};

// Confirm

export const confirmSession = async (bookingId: string, userId: string) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }

  if (existing.status !== BookingStatus.ACCEPTED) {
    throw new AppError('Only accepted bookings can be confirmed', 400);
  }

  const isProvider = existing.provider.toString() === userId;
  const isReceiver = existing.receiver.toString() === userId;
  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  // Atomic flag-set + fresh read. Avoids the lost-update race where two
  // near-simultaneous confirmations (one per party) each see only their OWN
  // flag flipped locally, so neither observes "both confirmed" - even though
  // the database ends up with both flags true and the booking silently never
  // completes.
  const flagUpdate = isProvider
    ? { providerConfirmed: true }
    : { receiverConfirmed: true };

  const afterFlag = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BookingStatus.ACCEPTED },
    { $set: flagUpdate },
    { returnDocument: 'after' },
  );
  if (!afterFlag) {
    throw new AppError('Only accepted bookings can be confirmed', 400);
  }

  const bothConfirmed =
    afterFlag.providerConfirmed && afterFlag.receiverConfirmed;
  if (!bothConfirmed) {
    return afterFlag;
  }

  // Gate the actual completion transition atomically too. Even if both
  // parties' requests both observe bothConfirmed === true in the narrow
  // race window, only ONE of them can actually win this conditional update
  // and proceed to release escrow.
  const session = await mongoose.startSession();
  let booking: BookingDocument | null;
  try {
    booking = await session.withTransaction<BookingDocument | null>(
      async () => {
        const updated = await Booking.findOneAndUpdate(
          { _id: bookingId, status: BookingStatus.ACCEPTED },
          { $set: { status: BookingStatus.COMPLETED } },
          { session, returnDocument: 'after' },
        );
        if (!updated) {
          // Someone else's concurrent request already completed it - nothing
          // more to do on this call.
          return null;
        }
        await releaseEscrow(
          bookingId,
          updated.receiver.toString(),
          updated.provider.toString(),
          updated.creditsTotal,
          session,
        );
        return updated;
      },
    );
  } finally {
    session.endSession();
  }

  if (!booking) {
    // Completion already happened via the other party's concurrent request.
    return afterFlag;
  }

  notifyBookingCompleted({
    recipientId: booking.provider.toString(),
    bookingId,
  });
  notifyBookingCompleted({
    recipientId: booking.receiver.toString(),
    bookingId,
  });
  notifyCreditsReleased({
    providerId: booking.provider.toString(),
    amount: booking.creditsTotal,
    bookingId,
  });

  return booking;
};

// Dispute

export const disputeBooking = async (bookingId: string, userId: string) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }

  const isProvider = existing.provider.toString() === userId;
  const isReceiver = existing.receiver.toString() === userId;
  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  // No money moves on dispute (credits stay in escrow) - atomic conditional
  // update is enough, no session needed.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BookingStatus.ACCEPTED },
    { $set: { status: BookingStatus.DISPUTED } },
    { returnDocument: 'after' },
  );
  if (!booking) {
    throw new AppError('Only accepted bookings can be disputed', 400);
  }

  const disputer = await User.findById(userId).select('name');
  const otherPartyId = isProvider
    ? booking.receiver.toString()
    : booking.provider.toString();

  notifyDisputeFiled({
    recipientId: otherPartyId,
    filedByName: disputer?.name ?? 'The other party',
    bookingId,
  });

  return booking;
};

// Add meeting link

export const addMeetingLink = async (
  bookingId: string,
  userId: string,
  data: AddMeetingLinkInput,
) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }
  if (existing.provider.toString() !== userId) {
    throw new AppError('Only the provider can add a meeting link', 403);
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BookingStatus.ACCEPTED },
    { $set: { meetingLink: data.meetingLink } },
    { returnDocument: 'after' },
  );
  if (!booking) {
    throw new AppError(
      'Meeting link can only be added to accepted bookings',
      400,
    );
  }

  notifyMeetingLinkAdded({
    recipientId: booking.receiver.toString(),
    bookingId,
  });

  return booking;
};

// Get one

export const getBooking = async (bookingId: string, userId: string) => {
  const booking = await Booking.findById(bookingId)
    .populate('provider', 'name photo')
    .populate('receiver', 'name photo')
    .populate('listing', 'title hourlyRate')
    .populate('request', 'title creditsOffered');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  const isProvider = booking.provider._id.toString() === userId;
  const isReceiver = booking.receiver._id.toString() === userId;
  if (!isProvider && !isReceiver) {
    throw new AppError('You do not have access to this booking', 403);
  }

  return booking;
};

// Get all

export const getAllBookings = async (
  userId: string,
  query: BookingQueryInput,
) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    $or: [
      { provider: new mongoose.Types.ObjectId(userId) },
      { receiver: new mongoose.Types.ObjectId(userId) },
    ],
  };

  if (status) {
    filter.status = status;
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('provider', 'name photo')
      .populate('receiver', 'name photo')
      .populate('listing', 'title hourlyRate')
      .populate('request', 'title creditsOffered')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};
