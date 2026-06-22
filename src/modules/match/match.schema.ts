import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const matchParamsSchema = z.object({
  id: objectIdSchema,
});

export const matchQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'notified', 'accepted', 'dismissed']).optional(),
});

export type MatchParams = z.infer<typeof matchParamsSchema>;
export type MatchQuery = z.infer<typeof matchQuerySchema>;
