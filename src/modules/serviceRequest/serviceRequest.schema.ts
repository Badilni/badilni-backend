import { z } from 'zod';
import {
  baseListingSchema,
  dateFilterSchema,
  imageSchema,
  numericQueryParam,
  objectIdSchema,
  paginationSchema,
} from '../../utils/common.schema.js';

export const createServiceRequestSchema = baseListingSchema.extend({
  creditsOffered: z.coerce.number().int().min(1),
  deadline: z.iso.datetime().optional(),
  referenceImages: z.array(imageSchema).max(5).optional(),
});

export const updateServiceRequestSchema = createServiceRequestSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'At least one field must be provided for update',
  });

export const serviceRequestQuerySchema = paginationSchema.extend({
  category: objectIdSchema.optional(),
  user: objectIdSchema.optional(),
  status: z.enum(['open', 'matched', 'fulfilled', 'expired']).optional(),
  creditsOffered: numericQueryParam.optional(),
  createdAt: dateFilterSchema.optional(),
});

export const serviceRequestParamsSchema = z.object({
  id: objectIdSchema,
});

export const userServiceRequestsParamsSchema = z.object({
  userId: objectIdSchema.optional(),
});

export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestSchema
>;
export type UpdateServiceRequestInput = z.infer<
  typeof updateServiceRequestSchema
>;
export type ServiceRequestQuery = z.infer<typeof serviceRequestQuerySchema>;
export type ServiceRequestParams = z.infer<typeof serviceRequestParamsSchema>;
export type UserServiceRequestsParams = z.infer<
  typeof userServiceRequestsParamsSchema
>;
