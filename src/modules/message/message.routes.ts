import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as messageController from './message.controller.js';
import {
  conversationParamsSchema,
  messageQuerySchema,
  sendMessageSchema,
} from './message.schema.js';

const router = Router();

router.use(protect);

router.get('/conversations', messageController.getConversations);

router.get(
  '/conversations/:userId',
  validate({ params: conversationParamsSchema, query: messageQuerySchema }),
  messageController.getConversationMessages,
);

router.post(
  '/',
  validate({ body: sendMessageSchema }),
  messageController.sendMessage,
);

export { router as messageRouter };
