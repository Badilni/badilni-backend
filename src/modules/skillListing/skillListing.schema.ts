import { z } from 'zod';
import {
  baseListingSchema,
  coerceBoolean,
  dateFilterSchema,
  imageSchema,
  numericQueryParam,
  objectIdSchema,
  paginationSchema,
} from '../../utils/common.schema.js';

export const createSkillListingSchema = baseListingSchema.extend({
  hourlyRate: z.coerce.number().int().min(1).max(20),
  availabilityNotes: z.string().max(300).trim().optional(),
  sampleWork: z.array(imageSchema).max(5).optional(),
});

export const updateSkillListingSchema = createSkillListingSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'At least one field must be provided for update',
  });

export const skillListingQuerySchema = paginationSchema.extend({
  category: objectIdSchema.optional(),
  user: objectIdSchema.optional(),
  isActive: coerceBoolean.optional(),
  hourlyRate: numericQueryParam.optional(),
  averageRating: numericQueryParam.optional(),
  createdAt: dateFilterSchema.optional(),
});

export const skillListingParamsSchema = z.object({
  id: objectIdSchema,
});

export const userSkillListingsParamsSchema = z.object({
  userId: objectIdSchema.optional(),
});

export type CreateSkillListingInput = z.infer<typeof createSkillListingSchema>;
export type UpdateSkillListingInput = z.infer<typeof updateSkillListingSchema>;
export type SkillListingQuery = z.infer<typeof skillListingQuerySchema>;
export type SkillListingParams = z.infer<typeof skillListingParamsSchema>;
export type UserSkillListingsParams = z.infer<
  typeof userSkillListingsParamsSchema
>;
