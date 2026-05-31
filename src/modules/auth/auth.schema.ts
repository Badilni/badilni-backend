import { z } from 'zod';

export const EmailSchema = z.object({
  email: z.email().toLowerCase(),
});

export const EmailCodeSchema = EmailSchema.extend({
  code: z.string().length(6).toUpperCase(),
});

export const CreateUserSchema = z.object({
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

const PasswordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    'Password must contain at least special character',
  );

export const SignupSchema = CreateUserSchema.pick({
  name: true,
  email: true,
})
  .extend({
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

export const LoginSchema = EmailSchema.extend({
  password: z.string().min(1),
});

export const ResetPasswordSchema = EmailCodeSchema.extend({
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  error: 'Passwords do not match',
});

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type EmailInput = z.infer<typeof EmailSchema>;
export type EmailCodeInput = z.infer<typeof EmailCodeSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
