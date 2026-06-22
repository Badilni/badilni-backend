import { z } from 'zod';
import { objectIdSchema } from '../../utils/common.schema.js';

export const suspendUserSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const creditAdjustSchema = z.object({
  amount: z.coerce.number().int().refine((val) => val !== 0, {
    error: 'Amount must not be zero',
  }),
  reason: z.string().min(5).max(500),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['favor_receiver', 'favor_provider', 'split']),
  reason: z.string().min(5).max(500),
});

export const adminUserParamsSchema = z.object({
  userId: objectIdSchema,
});

export const adminBookingParamsSchema = z.object({
  bookingId: objectIdSchema,
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type CreditAdjustInput = z.infer<typeof creditAdjustSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type AdminUserParams = z.infer<typeof adminUserParamsSchema>;
export type AdminBookingParams = z.infer<typeof adminBookingParamsSchema>;
