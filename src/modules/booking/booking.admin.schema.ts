import { z } from 'zod';
import { dateFilterSchema, objectIdSchema } from '../../utils/common.schema.js';
import { BookingStatus } from './booking.types.js';

export const adminBookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum(Object.values(BookingStatus) as [string, ...string[]])
    .optional(),
  userId: objectIdSchema.optional(),
  createdAt: dateFilterSchema.optional(),
});

export const adminDisputeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  // Search fields — all optional, only one typically used at a time
  bookingId: objectIdSchema.optional(),
  providerId: objectIdSchema.optional(),
  receiverId: objectIdSchema.optional(),
});

export const adminCreditFlowQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const adminOverviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type AdminBookingQueryInput = z.infer<typeof adminBookingQuerySchema>;
export type AdminDisputeQueryInput = z.infer<typeof adminDisputeQuerySchema>;
export type AdminCreditFlowQueryInput = z.infer<
  typeof adminCreditFlowQuerySchema
>;
export type AdminOverviewQueryInput = z.infer<typeof adminOverviewQuerySchema>;
