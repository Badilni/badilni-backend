import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const createCategorySchema = z.object({
  name: z.string(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'At least one field must be provided for update',
  });

export const categoryParamSchema = z.object({
  id: objectIdSchema,
});

export const categoryQuerySchema = paginationSchema.extend({
  slug: z
    .string()
    .toLowerCase()
    .optional()
    .transform((val) => (val ? val.split(' ').join('-') : undefined)),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryParams = z.infer<typeof categoryParamSchema>;
export type CategoryQuery = z.infer<typeof categoryQuerySchema>;
