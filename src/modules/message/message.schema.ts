import { z } from 'zod';
import { objectIdSchema } from '../../utils/common.schema.js';

export const sendConversationMessageSchema = z
  .object({
    body: z.string().max(2000).trim().optional(),
    referenceType: z.enum(['SkillListing', 'ServiceRequest']).optional(),
    reference: objectIdSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasRefType = Boolean(data.referenceType);
    const hasRef = Boolean(data.reference);
    if (hasRefType !== hasRef) {
      ctx.addIssue({
        code: 'custom',
        message: 'referenceType and reference must both be provided together',
        path: ['referenceType'],
      });
    }
  });

export const sendConversationParamsSchema = z.object({
  recipientId: objectIdSchema,
});

export const sendBookingMessageSchema = z.object({
  body: z.string().max(2000).trim().optional(),
});

export const conversationParamsSchema = z.object({
  conversationId: objectIdSchema,
});

export const bookingChatParamsSchema = z.object({
  bookingId: objectIdSchema,
});

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const inboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendConversationMessageInput = z.infer<
  typeof sendConversationMessageSchema
>;
export type SendBookingMessageInput = z.infer<typeof sendBookingMessageSchema>;
export type SendConversationParams = z.infer<
  typeof sendConversationParamsSchema
>;
export type ConversationParams = z.infer<typeof conversationParamsSchema>;
export type BookingChatParams = z.infer<typeof bookingChatParamsSchema>;
export type MessageQuery = z.infer<typeof messageQuerySchema>;
export type InboxQuery = z.infer<typeof inboxQuerySchema>;
