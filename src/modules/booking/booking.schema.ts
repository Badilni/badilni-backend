import { z } from 'zod';
import { objectIdSchema } from '../../utils/common.schema.js';
import { BookingStatus } from './booking.types.js';

export const createBookingSchema = z
  .object({
    listing: objectIdSchema.optional(),
    request: objectIdSchema.optional(),
    scheduledAt: z.iso.datetime(),
    durationHours: z.coerce.number().min(0.5).max(8),
    note: z.string().max(500).trim().optional(),
  })
  .superRefine((data, ctx) => {
    const hasListing = data.listing !== undefined && data.listing !== null;
    const hasRequest = data.request !== undefined && data.request !== null;
    if (hasListing === hasRequest) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of listing or request must be provided',
        path: ['listing'],
      });
    }
  });

export const bookingParamsSchema = z.object({
  id: objectIdSchema,
});

export const cancelBookingSchema = z.object({
  cancellationReason: z.string().max(500).trim().optional(),
});

export const addMeetingLinkSchema = z.object({
  meetingLink: z.string().url({ message: 'meetingLink must be a valid URL' }),
});

export const bookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(BookingStatus).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type BookingParamsInput = z.infer<typeof bookingParamsSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type AddMeetingLinkInput = z.infer<typeof addMeetingLinkSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;
