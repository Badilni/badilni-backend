import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as notificationController from './notification.controller.js';
import {
  notificationParamsSchema,
  notificationQuerySchema,
} from './notification.schema.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  validate({ query: notificationQuerySchema }),
  notificationController.getMyNotifications,
);

router.get('/unread-count', notificationController.getUnreadCount);

router.patch('/read-all', notificationController.markAllAsRead);

router.patch(
  '/:id/read',
  validate({ params: notificationParamsSchema }),
  notificationController.markAsRead,
);

export { router as notificationRouter };
