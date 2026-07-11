import mongoose, { ClientSession } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
} from '../../models/transaction.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import { TransactionType } from './transaction.types.js';
import {
  AdminAdjustmentInput,
  AdminTransactionQuery,
  TransactionQuery,
} from './transaction.schema.js';
import { notifyAdminAdjustment } from '../notification/notification.service.js';
import * as adminActionService from '../adminAction/adminAction.service.js';

// Shared functions called by other modules (Booking, Auth)

/**
 * Credit the welcome bonus to a newly verified user.
 * Must be called inside the same MongoDB session that marks isVerified = true.
 */
export const creditWelcomeBonus = async (
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  const BONUS = 3;

  await Transaction.create(
    [
      {
        fromUser: null,
        toUser: userId,
        amount: BONUS,
        type: TransactionType.WELCOME_BONUS,
      },
    ],
    { session },
  );

  await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: BONUS } },
    { session },
  );
};

/**
 * Lock credits into escrow when a booking is accepted.
 * NO Transaction document is created - this is a wallet state change only.
 */
export const lockEscrow = async (
  bookingId: string,
  receiverId: string,
  amount: number,
  session: ClientSession,
): Promise<void> => {
  const updatedReceiver = await User.findOneAndUpdate(
    { _id: receiverId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount, creditsInEscrow: amount } },
    { session, new: true },
  );

  if (!updatedReceiver) {
    throw new AppError('Receiver no longer has sufficient balance', 400);
  }

  await Transaction.create(
    [
      {
        fromUser: receiverId,
        toUser: receiverId,
        amount,
        type: TransactionType.ESCROW_LOCK,
        booking: bookingId,
      },
    ],
    { session },
  );
};

/**
 * Release credits from escrow to the provider on session completion.
 * Creates one session_payment Transaction.
 */
export const releaseEscrow = async (
  bookingId: string,
  receiverId: string,
  providerId: string,
  amount: number,
  session?: ClientSession,
): Promise<void> => {
  await Transaction.create(
    [
      {
        fromUser: receiverId,
        toUser: providerId,
        amount,
        type: TransactionType.SESSION_PAYMENT,
        booking: bookingId,
      },
    ],
    { session },
  );

  await User.findByIdAndUpdate(
    receiverId,
    { $inc: { creditsInEscrow: -amount } },
    { session },
  );

  await User.findByIdAndUpdate(
    providerId,
    { $inc: { walletBalance: amount } },
    { session },
  );
};

/**
 * Refund escrowed credits back to the receiver on cancellation.
 * Creates one refund Transaction.
 */
export const refundEscrow = async (
  bookingId: string,
  receiverId: string,
  amount: number,
  session: ClientSession,
): Promise<void> => {
  await Transaction.create(
    [
      {
        fromUser: receiverId,
        toUser: receiverId,
        amount,
        type: TransactionType.REFUND,
        booking: bookingId,
      },
    ],
    { session },
  );

  await User.findByIdAndUpdate(
    receiverId,
    { $inc: { creditsInEscrow: -amount, walletBalance: amount } },
    { session },
  );
};

// User-facing read functions

export const getWalletHistory = async (
  userId: string,
  query: TransactionQuery,
) => {
  const { page, limit, type, createdAt } = query;
  const skip = (page - 1) * limit;

  const matchFilter: Record<string, unknown> = {
    $or: [
      { toUser: new mongoose.Types.ObjectId(userId) },
      { fromUser: new mongoose.Types.ObjectId(userId) },
    ],
  };

  if (type) {
    matchFilter.type = type;
  }

  if (createdAt) {
    matchFilter.createdAt = {
      ...(createdAt.gt && { $gt: createdAt.gt }),
      ...(createdAt.gte && { $gte: createdAt.gte }),
      ...(createdAt.lt && { $lt: createdAt.lt }),
      ...(createdAt.lte && { $lte: createdAt.lte }),
    };
  }

  const [result] = await Transaction.aggregate([
    { $match: matchFilter },
    {
      $facet: {
        transactions: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'fromUser',
              foreignField: '_id',
              as: 'fromUser',
              pipeline: [{ $project: { name: 1, avatar: 1 } }],
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'toUser',
              foreignField: '_id',
              as: 'toUser',
              pipeline: [{ $project: { name: 1, avatar: 1 } }],
            },
          },
          {
            $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true },
          },
          { $unwind: { path: '$toUser', preserveNullAndEmptyArrays: true } },
        ],
        totalCount: [{ $count: 'count' }],
        totalEarned: [
          {
            $match: {
              toUser: new mongoose.Types.ObjectId(userId),
              $expr: { $ne: ['$fromUser', '$toUser'] },
            },
          },
          { $group: { _id: null, sum: { $sum: '$amount' } } },
        ],
        totalSpent: [
          {
            $match: {
              fromUser: new mongoose.Types.ObjectId(userId),
              $expr: { $ne: ['$fromUser', '$toUser'] },
            },
          },
          { $group: { _id: null, sum: { $sum: '$amount' } } },
        ],
      },
    },
  ]);

  const user = await User.findById(userId).select(
    'walletBalance creditsInEscrow',
  );
  const total = result.totalCount[0]?.count ?? 0;

  return {
    transactions: result.transactions,
    walletSummary: {
      walletBalance: user?.walletBalance ?? 0,
      creditsInEscrow: user?.creditsInEscrow ?? 0,
      totalEarned: result.totalEarned[0]?.sum ?? 0,
      totalSpent: result.totalSpent[0]?.sum ?? 0,
    },
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

export const getWalletBalance = async (userId: string) => {
  const user = await User.findById(userId).select(
    'walletBalance creditsInEscrow',
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return {
    walletBalance: user.walletBalance,
    creditsInEscrow: user.creditsInEscrow,
  };
};

// Admin functions

export const getAllTransactionsAdmin = async (query: AdminTransactionQuery) => {
  const { page, limit, userId, type, createdAt } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (userId) {
    filter.$or = [
      { toUser: new mongoose.Types.ObjectId(userId) },
      { fromUser: new mongoose.Types.ObjectId(userId) },
    ];
  }
  if (type) {
    filter.type = type;
  }
  if (createdAt) {
    filter.createdAt = {
      ...(createdAt.gt && { $gt: createdAt.gt }),
      ...(createdAt.gte && { $gte: createdAt.gte }),
      ...(createdAt.lt && { $lt: createdAt.lt }),
      ...(createdAt.lte && { $lte: createdAt.lte }),
    };
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate('fromUser', 'name avatar')
      .populate('toUser', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

export const adminAdjustment = async (
  data: AdminAdjustmentInput,
  adminId: string,
) => {
  const { userId, amount, description } = data;
  const session = await mongoose.startSession();
  let transaction: TransactionDocument;
  let user;

  try {
    await session.withTransaction(async () => {
      user = await User.findById(userId).session(session);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (amount < 0 && user.walletBalance + amount < 0) {
        throw new AppError(
          'Adjustment would bring the user wallet below zero',
          400,
        );
      }

      const isCredit = amount > 0;

      [transaction] = await Transaction.create(
        [
          {
            fromUser: isCredit ? null : userId,
            toUser: isCredit ? userId : null,
            amount: Math.abs(amount),
            type: TransactionType.ADMIN_ADJUSTMENT,
            description,
          },
        ],
        { session },
      );

      await User.findByIdAndUpdate(
        userId,
        { $inc: { walletBalance: amount } },
        { session },
      );
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to apply credit adjustment', 500);
  } finally {
    session.endSession();
  }

  notifyAdminAdjustment({
    userId,
    amount,
    description,
  });

  adminActionService.logAction({
    adminId,
    action: 'credit_adjust',
    targetId: userId,
    targetModel: 'User',
    details: {
      amount,
      description,
      transactionId: transaction!._id?.toString(),
    },
  });

  return transaction!;
};
