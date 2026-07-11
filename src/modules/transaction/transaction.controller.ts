import { asyncHandler } from '../../utils/asyncHandler.js';
import * as transactionService from './transaction.service.js';
import {
  AdminAdjustmentInput,
  AdminTransactionQuery,
  TransactionQuery,
} from './transaction.schema.js';

// User-facing handlers

export const getWalletHistory = asyncHandler(async (req, res) => {
  const result = await transactionService.getWalletHistory(
    req.user!.id,
    req.query as unknown as TransactionQuery,
  );

  res.status(200).json({
    status: 'success',
    walletSummary: result.walletSummary,
    pagination: result.pagination,
    data: { transactions: result.transactions },
  });
});

export const getWalletBalance = asyncHandler(async (req, res) => {
  const result = await transactionService.getWalletBalance(req.user!.id);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

// Admin handlers

export const getAllTransactionsAdmin = asyncHandler(async (req, res) => {
  const result = await transactionService.getAllTransactionsAdmin(
    req.query as unknown as AdminTransactionQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { transactions: result.transactions },
  });
});

export const adminAdjustment = asyncHandler(async (req, res) => {
  const transaction = await transactionService.adminAdjustment(
    req.body as AdminAdjustmentInput,
    req.user!.id,
  );

  res.status(201).json({
    status: 'success',
    data: { transaction },
  });
});