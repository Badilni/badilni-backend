import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z
    .string()
    .regex(/^-?[a-zA-Z0-9_]+(,-?[a-zA-Z0-9_]+)*$/)
    .optional(),
  fields: z
    .string()
    .regex(/^[a-zA-Z0-9_]+(,[a-zA-Z0-9_]+)*$/)
    .optional(),
  keyword: z.string().optional(),
});
