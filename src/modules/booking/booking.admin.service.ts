import mongoose from 'mongoose';
import { Booking } from '../../models/booking.model.js';
import { User } from '../../models/user.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { TransactionType } from '../transaction/transaction.types.js';
import { AppError } from '../../utils/appError.js';
import { BookingStatus } from './booking.types.js';
import {
  AdminBookingQueryInput,
  AdminDisputeQueryInput,
  ResolveDisputeInput,
} from './booking.admin.schema.js';
import {
  releaseEscrow,
  refundEscrow,
} from '../transaction/transaction.service.js';
import * as adminActionService from '../adminAction/adminAction.service.js';
import * as notificationService from '../notification/notification.service.js';

// Helpers

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
};

const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const pctChange = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
};

const fillDateRange = (
  rawData: { _id: string; count: number }[],
  days: number,
): { date: string; count: number }[] => {
  const map = new Map(rawData.map((d) => [d._id, d.count]));
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
  }

  return result;
};

// Stats (dashboard summary cards)

export const getStats = async () => {
  const now = new Date();
  const startOfThisWeek = getStartOfWeek(now);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfToday = getStartOfDay(now);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const [
    // Sessions this week vs last week (by scheduledAt - when session happened)
    sessionsThisWeek,
    sessionsLastWeek,

    // Open disputes - current snapshot
    openDisputes,
    // Disputes that transitioned to DISPUTED this week vs last week
    // using updatedAt because that is when status changed to DISPUTED
    disputesOpenedThisWeek,
    disputesOpenedLastWeek,

    // Pending bookings - current snapshot vs yesterday snapshot
    pendingBookings,
    pendingBookingsYesterday,

    // Credit circulation - sum of all user wallets + escrow
    creditsNow,
    // Credit circulation last week - sum of session_payment transactions
    // that occurred last week as a proxy for weekly flow
    creditTransactionsThisWeek,
    creditTransactionsLastWeek,
  ] = await Promise.all([
    Booking.countDocuments({
      status: BookingStatus.COMPLETED,
      scheduledAt: { $gte: startOfThisWeek },
    }),
    Booking.countDocuments({
      status: BookingStatus.COMPLETED,
      scheduledAt: { $gte: startOfLastWeek, $lt: startOfThisWeek },
    }),

    Booking.countDocuments({ status: BookingStatus.DISPUTED }),

    Booking.countDocuments({
      status: BookingStatus.DISPUTED,
      updatedAt: { $gte: startOfThisWeek },
    }),
    Booking.countDocuments({
      status: BookingStatus.DISPUTED,
      updatedAt: { $gte: startOfLastWeek, $lt: startOfThisWeek },
    }),

    Booking.countDocuments({ status: BookingStatus.PENDING }),
    // Approximate yesterday's pending count as: pending bookings created
    // before today that are still pending (not a perfect snapshot but
    // sufficient for a dashboard variance indicator)
    Booking.countDocuments({
      status: BookingStatus.PENDING,
      createdAt: { $lt: startOfToday },
    }),

    User.aggregate([
      {
        $group: {
          _id: null,
          totalWallet: { $sum: '$walletBalance' },
          totalEscrow: { $sum: '$creditsInEscrow' },
        },
      },
    ]),

    // Weekly credit volume = sum of session_payment amounts this week
    Transaction.aggregate([
      {
        $match: {
          type: TransactionType.SESSION_PAYMENT,
          createdAt: { $gte: startOfThisWeek },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          type: TransactionType.SESSION_PAYMENT,
          createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const credits = creditsNow[0] ?? { totalWallet: 0, totalEscrow: 0 };
  const totalCreditsInCirculation = credits.totalWallet + credits.totalEscrow;

  const creditFlowThisWeek = creditTransactionsThisWeek[0]?.total ?? 0;
  const creditFlowLastWeek = creditTransactionsLastWeek[0]?.total ?? 0;

  return {
    sessionsThisWeek,
    sessionsThisWeekChange: pctChange(sessionsThisWeek, sessionsLastWeek),

    openDisputes,
    openDisputesChange: pctChange(
      disputesOpenedThisWeek,
      disputesOpenedLastWeek,
    ),

    pendingBookings,
    pendingBookingsChange: pctChange(pendingBookings, pendingBookingsYesterday),

    totalCreditsInCirculation,
    totalCreditsInEscrow: credits.totalEscrow,
    creditCirculationChange: pctChange(creditFlowThisWeek, creditFlowLastWeek),
  };
};

// Sessions Overview bar chart (last N days, default 7)

export const getOverview = async (days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const rawData = await Booking.aggregate([
    {
      $match: {
        status: BookingStatus.COMPLETED,
        // scheduledAt - when the session happened, not when booking was created
        scheduledAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillDateRange(rawData, days);
};

// Sessions by status - last 7 days with percentages

export const getByStatus = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const data = await Booking.aggregate([
    {
      // Filter to last 7 days by scheduledAt
      $match: { scheduledAt: { $gte: sevenDaysAgo } },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Build base with all statuses at 0
  const counts: Record<string, number> = Object.values(BookingStatus).reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {},
  );

  data.forEach(({ _id, count }) => {
    counts[_id] = count;
  });

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  // Return counts and percentages
  const result: Record<string, { count: number; percentage: number }> = {};
  for (const [status, count] of Object.entries(counts)) {
    result[status] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  }

  return result;
};

// Credit Flow dual bar chart (last N days, default 7)

export const getCreditFlow = async (days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  // Credits IN = session_payment transactions (provider receives credits)
  // Credits OUT = escrow_lock transactions (receiver's credits get locked)
  // Both grouped by date
  const rawData = await Transaction.aggregate([
    {
      $match: {
        type: {
          $in: [TransactionType.SESSION_PAYMENT, TransactionType.ESCROW_LOCK],
        },
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Build a map keyed by date
  const map = new Map<string, { creditsIn: number; creditsOut: number }>();

  rawData.forEach(({ _id, total }) => {
    const entry = map.get(_id.date) ?? { creditsIn: 0, creditsOut: 0 };
    if (_id.type === TransactionType.SESSION_PAYMENT) {
      entry.creditsIn = total;
    } else {
      entry.creditsOut = total;
    }
    map.set(_id.date, entry);
  });

  // Fill all days including days with no transactions
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = map.get(dateStr) ?? { creditsIn: 0, creditsOut: 0 };
    result.push({ date: dateStr, ...entry });
  }

  return result;
};

// Disputes list with search

export const getDisputes = async (query: AdminDisputeQueryInput) => {
  const { page, limit, bookingId, providerId, receiverId } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    status: BookingStatus.DISPUTED,
  };

  // bookingId search - direct _id match
  if (bookingId) {
    filter._id = new mongoose.Types.ObjectId(bookingId);
  }

  if (providerId) {
    filter.provider = new mongoose.Types.ObjectId(providerId);
  }

  if (receiverId) {
    filter.receiver = new mongoose.Types.ObjectId(receiverId);
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('provider', 'name avatar email')
      .populate('receiver', 'name avatar email')
      .populate('listing', 'title')
      .populate('request', 'title')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

// All bookings admin browse

export const getAllBookingsAdmin = async (query: AdminBookingQueryInput) => {
  const { page, limit, status, userId, createdAt } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (userId) {
    filter.$or = [
      { provider: new mongoose.Types.ObjectId(userId) },
      { receiver: new mongoose.Types.ObjectId(userId) },
    ];
  }

  if (createdAt) {
    filter.createdAt = {
      ...(createdAt.gt && { $gt: createdAt.gt }),
      ...(createdAt.gte && { $gte: createdAt.gte }),
      ...(createdAt.lt && { $lt: createdAt.lt }),
      ...(createdAt.lte && { $lte: createdAt.lte }),
    };
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('provider', 'name avatar email')
      .populate('receiver', 'name avatar email')
      .populate('listing', 'title hourlyRate')
      .populate('request', 'title creditsOffered')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

// Single booking full detail

export const getBookingAdmin = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId)
    .populate('provider', 'name avatar email walletBalance creditsInEscrow')
    .populate('receiver', 'name avatar email walletBalance creditsInEscrow')
    .populate('listing')
    .populate('request')
    .populate('cancelledBy', 'name');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  const transactions = await Transaction.find({ booking: bookingId }).sort({
    createdAt: 1,
  });

  return { booking, transactions };
};

// Resolve a disputed booking

export const resolveDispute = async (
  bookingId: string,
  adminId: string,
  data: ResolveDisputeInput,
) => {
  const existing = await Booking.findById(bookingId);
  if (!existing) {
    throw new AppError('Booking not found', 404);
  }
  if (existing.status !== BookingStatus.DISPUTED) {
    throw new AppError('Only disputed bookings can be resolved', 400);
  }

  const receiverId = existing.receiver.toString();
  const providerId = existing.provider.toString();
  const amount = existing.creditsTotal;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (data.resolution === 'favor_provider') {
        await releaseEscrow(bookingId, receiverId, providerId, amount, session);
      } else if (
        data.resolution === 'favor_receiver' ||
        data.resolution === 'refund'
      ) {
        await refundEscrow(bookingId, receiverId, amount, session);
      } else {
        // split - 50/50 between provider and receiver. Any odd remainder
        // goes to the receiver so the two shares always sum to the exact
        // escrowed amount.
        const providerShare = Math.floor(amount / 2);
        const receiverShare = amount - providerShare;

        if (providerShare > 0) {
          await releaseEscrow(
            bookingId,
            receiverId,
            providerId,
            providerShare,
            session,
          );
        }
        if (receiverShare > 0) {
          await refundEscrow(bookingId, receiverId, receiverShare, session);
        }
      }

      await Booking.findByIdAndUpdate(
        bookingId,
        {
          $set: {
            // favor_provider is treated as the session having happened;
            // every other resolution returns some or all credits, so the
            // booking is treated the same as a cancellation.
            status:
              data.resolution === 'favor_provider'
                ? BookingStatus.COMPLETED
                : BookingStatus.CANCELLED,
          },
        },
        { session },
      );
    });
  } finally {
    session.endSession();
  }

  adminActionService.logAction({
    adminId,
    action: 'resolve_dispute',
    targetId: bookingId,
    targetModel: 'Booking',
    details: { resolution: data.resolution, reason: data.reason },
  });

  // Notify both parties with a resolution-specific message so each user
  // understands what happened to their credits without checking their wallet.
  const providerBody =
    data.resolution === 'favor_provider'
      ? `The dispute for your session has been resolved in your favour. ${amount} Time Credits have been released to your wallet.`
      : data.resolution === 'split'
        ? `The dispute for your session has been resolved with a split. ${Math.floor(amount / 2)} Time Credits have been released to your wallet.`
        : 'The dispute for your session has been resolved. Credits were returned to the other party.';

  const receiverBody =
    data.resolution === 'favor_receiver' || data.resolution === 'refund'
      ? `The dispute for your session has been resolved in your favour. ${amount} Time Credits have been refunded to your wallet.`
      : data.resolution === 'split'
        ? `The dispute for your session has been resolved with a split. ${amount - Math.floor(amount / 2)} Time Credits have been refunded to your wallet.`
        : 'The dispute for your session has been resolved. Credits were released to the other party.';

  notificationService.notifyDisputeResolved({
    recipientId: providerId,
    bookingId,
    body: providerBody,
  });
  notificationService.notifyDisputeResolved({
    recipientId: receiverId,
    bookingId,
    body: receiverBody,
  });

  const booking = await Booking.findById(bookingId)
    .populate('provider', 'name avatar email')
    .populate('receiver', 'name avatar email')
    .populate('listing', 'title hourlyRate')
    .populate('request', 'title creditsOffered');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  return booking;
};
