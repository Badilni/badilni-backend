import { z } from 'zod';
import {
  dateFilterSchema,
  objectIdSchema,
  paginationSchema,
} from '../../utils/common.schema.js';

export const createBookingSchema = z
  .object({
    listingId: objectIdSchema.optional(),
    requestId: objectIdSchema.optional(),
    scheduledAt: z.iso.datetime(),
    durationHours: z.coerce.number().min(0.5).max(12),
  })
  .refine(
    (data) => Boolean(data.listingId) !== Boolean(data.requestId),
    {
      path: ['listingId'],
      error: 'Provide exactly one of listingId or requestId',
    },
  );

export const acceptBookingSchema = z.object({
  meetingLink: z.url(),
});

export const cancelBookingSchema = z.object({
  cancellationReason: z.string().min(3).max(300).optional(),
});

export const disputeBookingSchema = z.object({
  reason: z.string().min(10).max(500),
});

export const bookingParamsSchema = z.object({
  id: objectIdSchema,
});

export const bookingQuerySchema = paginationSchema.extend({
  status: z
    .enum(['pending', 'accepted', 'declined', 'completed', 'disputed', 'cancelled'])
    .optional(),
  receiverId: objectIdSchema.optional(),
  providerId: objectIdSchema.optional(),
  scheduledAt: dateFilterSchema.optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AcceptBookingInput = z.infer<typeof acceptBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type DisputeBookingInput = z.infer<typeof disputeBookingSchema>;
export type BookingParams = z.infer<typeof bookingParamsSchema>;
export type BookingQuery = z.infer<typeof bookingQuerySchema>;
