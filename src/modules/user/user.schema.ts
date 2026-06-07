import { z } from 'zod';
import {
  coerceArray,
  coerceBoolean,
  objectIdSchema,
  paginationSchema,
  imageSchema,
} from '../../utils/common.schema.js';
import { passwordSchema } from '../auth/auth.schema.js';

// Admin only
export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email().toLowerCase(),
  avatar: imageSchema.optional(),
  role: z.enum(['user', 'admin']).default('user'),
  password: passwordSchema,
  bio: z.string().min(4).optional(),
  skillTags: coerceArray.optional(),
  walletBalance: z.number().nonnegative().default(0),
  creditsInEscrow: z.number().nonnegative().default(0),
  totalSessionsCompleted: z.number().nonnegative().default(0),
  averageRating: z.number().min(0).max(5).default(0),
  isVerified: coerceBoolean.default(false),
  active: coerceBoolean.default(false),
});

export const updateUserAdminSchema = createUserSchema
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

export const updateUserSelfSchema = createUserSchema
  .pick({
    name: true,
    avatar: true,
    bio: true,
    skillTags: true,
  })
  .partial();

export const userParamsSchema = z.object({
  id: objectIdSchema,
});

export const userQuerySchema = paginationSchema;

const baseAdminFilters = z.object({
  role: z.enum(['user', 'admin']),
  isVerified: coerceBoolean,
  active: coerceBoolean,
  email: z.email(),
});

export const adminQuerySchema = paginationSchema.extend(
  baseAdminFilters.partial().shape,
);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserAdminInput = z.infer<typeof updateUserAdminSchema>;
export type UpdateUserSelfInput = z.infer<typeof updateUserSelfSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type AdminQuery = z.infer<typeof adminQuerySchema>;
