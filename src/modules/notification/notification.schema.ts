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

export const adminSendNotificationSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(1000),
    target: z.enum(['broadcast', 'user']),
    userId: objectIdSchema.optional(),
  })
  .refine((data) => data.target !== 'user' || Boolean(data.userId), {
    path: ['userId'],
    error: 'userId is required when target is user',
  });

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
export type AdminSendNotificationInput = z.infer<typeof adminSendNotificationSchema>;