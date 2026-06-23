import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const notificationQuerySchema = paginationSchema
  .pick({ page: true, limit: true })
  .extend({
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  });

export const notificationParamsSchema = z.object({
  id: objectIdSchema,
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
