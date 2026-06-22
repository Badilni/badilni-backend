import { z } from 'zod';
import { coerceBoolean, objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const notificationParamsSchema = z.object({
  id: objectIdSchema,
});

export const notificationQuerySchema = paginationSchema.extend({
  isRead: coerceBoolean.optional(),
  type: z
    .enum([
      'booking_request',
      'booking_accepted',
      'booking_declined',
      'booking_cancelled',
      'session_confirmed',
      'credits_released',
      'match_suggestion',
      'new_review',
      'new_message',
    ])
    .optional(),
});

export type NotificationParams = z.infer<typeof notificationParamsSchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
