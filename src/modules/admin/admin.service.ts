import mongoose from 'mongoose';

import { AdminAction } from '../../models/adminAction.model.js';
import { Booking } from '../../models/booking.model.js';
import { Review } from '../../models/review.model.js';
import { Transaction } from '../../models/transaction.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreditAdjustInput,
  ResolveDisputeInput,
  SuspendUserInput,
} from './admin.schema.js';

const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000;

let dashboardCache: { data: unknown; cachedAt: number } | null = null;

// Stats are cached in-memory and refreshed every 15 minutes to avoid
// hammering the DB on every page load (see Badilni plan §6.9).
export const getDashboardStats = async () => {
  if (dashboardCache && Date.now() - dashboardCache.cachedAt < DASHBOARD_CACHE_TTL_MS) {
    return dashboardCache.data;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeUsers, sessionsThisWeek, openDisputes, creditCirculation] =
    await Promise.all([
      User.countDocuments({ active: true }),
      Booking.countDocuments({ status: 'completed', updatedAt: { $gte: weekAgo } }),
      Booking.countDocuments({ status: 'disputed' }),
      User.aggregate([
        {
          $group: {
            _id: null,
            walletBalance: { $sum: '$walletBalance' },
            creditsInEscrow: { $sum: '$creditsInEscrow' },
          },
        },
      ]),
    ]);

  const data = {
    activeUsers,
    sessionsThisWeek,
    openDisputes,
    creditsInCirculation: creditCirculation[0]?.walletBalance ?? 0,
    creditsInEscrow: creditCirculation[0]?.creditsInEscrow ?? 0,
  };

  dashboardCache = { data, cachedAt: Date.now() };

  return data;
};

export const getFlaggedReviews = async (queryString: Record<string, unknown>) => {
  const mongooseQuery = Review.find({ isFlagged: true })
    .populate('reviewerId', 'name avatar')
    .populate('revieweeId', 'name avatar');

  return dbFactory.findMany(mongooseQuery, queryString, ['comment']);
};

export const getDisputedBookings = async (
  queryString: Record<string, unknown>,
) => {
  const mongooseQuery = Booking.find({ status: 'disputed' })
    .populate('receiverId', 'name avatar')
    .populate('providerId', 'name avatar');

  return dbFactory.findMany(mongooseQuery, queryString, []);
};

export const suspendUser = async (
  adminId: string,
  targetUserId: string,
  data: SuspendUserInput,
) => {
  const user = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: targetUserId },
    { active: false },
  );

  await AdminAction.create({
    adminId,
    targetUserId,
    action: 'suspend',
    reason: data.reason,
  });

  return user;
};

export const unsuspendUser = async (
  adminId: string,
  targetUserId: string,
  data: SuspendUserInput,
) => {
  const user = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: targetUserId },
    { active: true },
  );

  await AdminAction.create({
    adminId,
    targetUserId,
    action: 'unsuspend',
    reason: data.reason,
  });

  return user;
};

export const adjustUserCredits = async (
  adminId: string,
  targetUserId: string,
  data: CreditAdjustInput,
) => {
  const session = await mongoose.startSession();

  try {
    let user;

    await session.withTransaction(async () => {
      if (data.amount < 0) {
        user = await User.findOneAndUpdate(
          { _id: targetUserId, walletBalance: { $gte: -data.amount } },
          { $inc: { walletBalance: data.amount } },
          { session, returnDocument: 'after' },
        );

        if (!user) {
          throw new AppError('User has insufficient credits for this deduction', 400);
        }
      } else {
        user = await User.findOneAndUpdate(
          { _id: targetUserId },
          { $inc: { walletBalance: data.amount } },
          { session, returnDocument: 'after' },
        );

        if (!user) {
          throw new AppError('No user found with this id', 404);
        }
      }

      await Transaction.create(
        [
          {
            fromUserId: data.amount < 0 ? targetUserId : null,
            toUserId: data.amount < 0 ? null : targetUserId,
            amount: Math.abs(data.amount),
            type: 'admin_adjustment',
            description: data.reason,
          },
        ],
        { session },
      );

      await AdminAction.create(
        [
          {
            adminId,
            targetUserId,
            action: 'credit_adjust',
            reason: data.reason,
          },
        ],
        { session },
      );
    });

    return user;
  } finally {
    session.endSession();
  }
};

// Admin manually resolves a disputed booking by adjusting credits per the
// chosen resolution (see Badilni plan §1.8 Dispute Resolution Interface).
export const resolveDispute = async (
  adminId: string,
  bookingId: string,
  data: ResolveDisputeInput,
) => {
  const session = await mongoose.startSession();

  try {
    let booking;

    await session.withTransaction(async () => {
      booking = await Booking.findOne({ _id: bookingId, status: 'disputed' }).session(
        session,
      );

      if (!booking) {
        throw new AppError('No disputed booking found with this id', 404);
      }

      if (data.resolution === 'favor_provider') {
        await User.updateOne(
          { _id: booking.receiverId },
          { $inc: { creditsInEscrow: -booking.creditsTotal } },
          { session },
        );
        await User.updateOne(
          { _id: booking.providerId },
          { $inc: { walletBalance: booking.creditsTotal, totalSessionsCompleted: 1 } },
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
              description: `Dispute resolved in favor of provider: ${data.reason}`,
            },
          ],
          { session },
        );
      } else if (data.resolution === 'favor_receiver') {
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
              description: `Dispute resolved in favor of receiver: ${data.reason}`,
            },
          ],
          { session },
        );
      } else {
        const half = Math.floor(booking.creditsTotal / 2);

        await User.updateOne(
          { _id: booking.receiverId },
          { $inc: { creditsInEscrow: -booking.creditsTotal, walletBalance: half } },
          { session },
        );
        await User.updateOne(
          { _id: booking.providerId },
          { $inc: { walletBalance: booking.creditsTotal - half } },
          { session },
        );
        await Transaction.create(
          [
            {
              fromUserId: null,
              toUserId: booking.receiverId,
              amount: half,
              type: 'refund',
              bookingId: booking._id,
              description: `Dispute split resolution: ${data.reason}`,
            },
            {
              fromUserId: booking.receiverId,
              toUserId: booking.providerId,
              amount: booking.creditsTotal - half,
              type: 'session_payment',
              bookingId: booking._id,
              description: `Dispute split resolution: ${data.reason}`,
            },
          ],
          { session },
        );
      }

      booking.status = 'completed';
      await booking.save({ session });

      await AdminAction.create(
        [
          {
            adminId,
            targetUserId: booking.receiverId,
            action: 'credit_adjust',
            reason: `Dispute resolution (${data.resolution}): ${data.reason}`,
          },
        ],
        { session },
      );
    });

    return booking;
  } finally {
    session.endSession();
  }
};
