import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';

export const sendMessageSchema = z.object({
  recipientId: objectIdSchema,
  body: z.string().min(1).max(2000).trim(),
});

export const conversationParamsSchema = z.object({
  userId: objectIdSchema,
});

export const messageQuerySchema = paginationSchema;

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConversationParams = z.infer<typeof conversationParamsSchema>;
export type MessageQuery = z.infer<typeof messageQuerySchema>;
