import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const createReviewSchema = z.object({
  bookingId: objectIdSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).trim().optional(),
});

export const reviewParamsSchema = z.object({
  id: objectIdSchema,
});

export const userReviewsParamsSchema = z.object({
  userId: objectIdSchema.optional(),
});

export const reviewQuerySchema = paginationSchema.extend({
  revieweeId: objectIdSchema.optional(),
  reviewerId: objectIdSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReviewParams = z.infer<typeof reviewParamsSchema>;
export type UserReviewsParams = z.infer<typeof userReviewsParamsSchema>;
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;