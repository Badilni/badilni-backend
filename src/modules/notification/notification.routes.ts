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

router
  .route('/')
  .get(
    validate({ query: notificationQuerySchema }),
    notificationController.getAll,
  );

router.route('/read-all').patch(notificationController.markAllAsRead);

router
  .route('/:id/read')
  .patch(
    validate({ params: notificationParamsSchema }),
    notificationController.markAsRead,
  );

router
  .route('/:id')
  .delete(
    validate({ params: notificationParamsSchema }),
    notificationController.deleteOne,
  );

export { router as notificationRouter };
