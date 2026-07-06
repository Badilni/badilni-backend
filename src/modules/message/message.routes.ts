import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { uploadAny } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as messageController from './message.controller.js';
import {
  conversationParamsSchema,
  inboxQuerySchema,
  messageQuerySchema,
  sendConversationMessageSchema,
  sendConversationParamsSchema,
} from './message.schema.js';

const router = Router();

router.use(protect);

router.post(
  '/:recipientId/messages',
  uploadAny.array('attachments', 5),
  validate({
    params: sendConversationParamsSchema,
    body: sendConversationMessageSchema,
  }),
  messageController.sendConversationMessage,
);

router.get('/unread-count', messageController.getUnreadConversationCount);
router.get(
  '/',
  validate({ query: inboxQuerySchema }),
  messageController.getConversations,
);

router.get(
  '/:conversationId/messages',
  validate({ params: conversationParamsSchema, query: messageQuerySchema }),
  messageController.getConversationMessages,
);

router.patch(
  '/:conversationId/messages/read',
  validate({ params: conversationParamsSchema }),
  messageController.markConversationAsRead,
);

export { router as conversationRouter };
