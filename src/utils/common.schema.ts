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

export const coerceBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((val) => val === true || val === 'true');

export const coerceArray = z.preprocess((val) => {
  if (Array.isArray(val)) {
    return val;
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return val.split(',').map((s) => s.trim());
    }
  }
  return val;
}, z.array(z.string()));

export const imageSchema = z.object({
  url: z.url(),
  publicId: z.string().optional(),
});

export const baseListingSchema = z.object({
  title: z.string().min(5).max(100).trim(),
  description: z.string().min(20).max(1000).trim(),
  category: objectIdSchema,
  // tags: coerceArray.refine((tags) => tags.length >= 1 && tags.length <= 8, {
  //   error: 'Must have between 1 and 8 tags',
  // }),
});

const numericFilterSchema = z.object({
  gt: z.coerce.number().optional(),
  gte: z.coerce.number().optional(),
  lt: z.coerce.number().optional(),
  lte: z.coerce.number().optional(),
});

export const numericQueryParam = z.union([
  z.coerce.number(),
  numericFilterSchema,
]);
