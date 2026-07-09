import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as adminController from './admin.controller.js';
import { auditLogQuerySchema } from './admin.schema.js';

const router = Router();

router.use(protect, restrictTo('admin'));

router.get(
  '/audit-log',
  validate({ query: auditLogQuerySchema }),
  adminController.getAuditLog,
);

export { router as adminRouter };