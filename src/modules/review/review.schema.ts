import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const createReviewSchema = z.object({
  booking: objectIdSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).trim().optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).trim().optional(),
  })
  .refine((data) => data.rating !== undefined || data.comment !== undefined, {
    error: 'Provide at least one of rating or comment',
  });

export const reviewParamsSchema = z.object({
  id: objectIdSchema,
});

export const reviewQuerySchema = paginationSchema.extend({
  type: z.enum(['received', 'given']).default('received'),
  user: objectIdSchema.optional(),
  booking: objectIdSchema.optional(),
  listing: objectIdSchema.optional(),
  reviewee: objectIdSchema.optional(),
  reviewer: objectIdSchema.optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ReviewParamsInput = z.infer<typeof reviewParamsSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
