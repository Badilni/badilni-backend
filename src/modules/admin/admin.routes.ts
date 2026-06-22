import { Router } from 'express';

import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../utils/common.schema.js';
import * as adminController from './admin.controller.js';
import {
  adminBookingParamsSchema,
  adminUserParamsSchema,
  creditAdjustSchema,
  resolveDisputeSchema,
  suspendUserSchema,
} from './admin.schema.js';

const router = Router();

router.use(protect, restrictTo('admin'));

router.get('/dashboard', adminController.getDashboardStats);

router.get(
  '/reviews/flagged',
  validate({ query: paginationSchema }),
  adminController.getFlaggedReviews,
);

router.get(
  '/bookings/disputed',
  validate({ query: paginationSchema }),
  adminController.getDisputedBookings,
);

router.patch(
  '/users/:userId/suspend',
  validate({ params: adminUserParamsSchema, body: suspendUserSchema }),
  adminController.suspendUser,
);

router.patch(
  '/users/:userId/unsuspend',
  validate({ params: adminUserParamsSchema, body: suspendUserSchema }),
  adminController.unsuspendUser,
);

router.patch(
  '/users/:userId/credits',
  validate({ params: adminUserParamsSchema, body: creditAdjustSchema }),
  adminController.adjustUserCredits,
);

router.patch(
  '/bookings/:bookingId/resolve-dispute',
  validate({ params: adminBookingParamsSchema, body: resolveDisputeSchema }),
  adminController.resolveDispute,
);

export { router as adminRouter };
