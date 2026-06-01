import { z } from 'zod';

export const emailSchema = z.object({
  email: z.email().toLowerCase(),
});

export const emailCodeSchema = emailSchema.extend({
  code: z.string().length(6).toUpperCase(),
});

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
});

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    'Password must contain at least special character',
  );

export const signupSchema = z
  .object({
    name: z.string().min(2),
    email: z.email().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

export const loginSchema = emailSchema.extend({
  password: z.string().min(1),
});

export const resetPasswordSchema = emailCodeSchema
  .extend({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type EmailCodeInput = z.infer<typeof emailCodeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
