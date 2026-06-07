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
