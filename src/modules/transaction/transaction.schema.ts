import { z } from 'zod';
import {
  dateFilterSchema,
  objectIdSchema,
  paginationSchema,
} from '../../utils/common.schema.js';
import { TransactionType } from './transaction.types.js';

const transactionTypeSchema = z.enum(TransactionType);

// Query schemas

export const transactionQuerySchema = paginationSchema
  .pick({ page: true, limit: true })
  .extend({
    type: transactionTypeSchema.optional(),
    dateFrom: z.iso.datetime({ offset: true }).optional(),
    createdAt: dateFilterSchema.optional(),
  });

export const adminTransactionQuerySchema = paginationSchema
  .pick({ page: true, limit: true })
  .extend({
    userId: objectIdSchema.optional(),
    type: transactionTypeSchema.optional(),
    dateFrom: z.iso.datetime({ offset: true }).optional(),
    createdAt: dateFilterSchema.optional(),
  });

// Body schemas

export const adminAdjustmentSchema = z.object({
  userId: objectIdSchema,
  // Positive = add credits, negative = deduct. Zero is meaningless.
  amount: z.number().refine((v) => v !== 0, {
    message: 'Amount must be non-zero',
  }),
  description: z.string().trim().min(5).max(500),
});

// TypeScript types

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type AdminTransactionQuery = z.infer<typeof adminTransactionQuerySchema>;
export type AdminAdjustmentInput = z.infer<typeof adminAdjustmentSchema>;
