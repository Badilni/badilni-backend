import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as adminActionController from './adminAction.controller.js';
import { auditLogQuerySchema } from './adminAction.schema.js';

const router = Router();

router.use(protect, restrictTo('admin'));

router.get(
  '/audit-log',
  validate({ query: auditLogQuerySchema }),
  adminActionController.getAuditLog,
);

export { router as adminActionRouter };
