import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email().toLowerCase(),
  photo: z.url().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  password: z.string().min(8),
  bio: z.string().min(4).optional(),
  skillTags: z.array(z.string()).default([]),
  walletBalance: z.number().nonnegative().default(0),
  creditsInEscrow: z.number().nonnegative().default(0),
  totalSessionsCompleted: z.number().nonnegative().default(0),
  averageRating: z.number().min(0).max(5).default(0),
  isVerified: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const adminUpdateUserSchema = createUserSchema
  .omit({
    password: true,
    walletBalance: true,
    creditsInEscrow: true,
    totalSessionsCompleted: true,
    averageRating: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'At least one field must be provided for update',
  });

export const userSelfUpdateSchema = createUserSchema.pick({
  name: true,
  email: true,
  photo: true,
  bio: true,
  skillTags: true,
  active: true,
});

export const userParamsSchema = z.object({
  id: objectIdSchema,
});

export const userQuerySchema = paginationSchema;

const booleanQuerySchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const baseAdminFilters = z.object({
  role: z.enum(['user', 'admin']),
  isVerified: booleanQuerySchema,
  active: booleanQuerySchema,
  email: z.email(),
});

export const adminQuerySchema = paginationSchema.extend(
  baseAdminFilters.partial().shape,
);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type UserSelfUpdateInput = z.infer<typeof userSelfUpdateSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type AdminQuery = z.infer<typeof adminQuerySchema>;
