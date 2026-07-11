import { z } from 'zod';
import { objectIdSchema } from '../../utils/common.schema.js';

export const matchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const matchParamsSchema = z.object({
  id: objectIdSchema,
});

export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type MatchParams = z.infer<typeof matchParamsSchema>;
