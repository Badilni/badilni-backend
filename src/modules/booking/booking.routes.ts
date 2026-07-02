import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.js';
import { normalizeBookingFilter } from '../../middleware/normalizeFilter.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { reviewRouter } from '../review/review.routes.js';
import * as bookingController from './booking.controller.js';
import * as adminBookingController from './booking.admin.controller.js';
import {
  addMeetingLinkSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
} from './booking.schema.js';
import {
  adminBookingQuerySchema,
  adminDisputeQuerySchema,
  adminCreditFlowQuerySchema,
  adminOverviewQuerySchema,
} from './booking.admin.schema.js';

// User-facing router

const router = Router();

// All booking routes require authentication
router.use(protect);

router.use('/:bookingId/reviews', normalizeBookingFilter, reviewRouter);

router
  .route('/')
  .post(
    upload.array('attachments', 3),
    validate({ body: createBookingSchema }),
    bookingController.createBooking,
  )
  .get(
    validate({ query: bookingQuerySchema }),
    bookingController.getAllBookings,
  );

router
  .route('/:id')
  .get(validate({ params: bookingParamsSchema }), bookingController.getBooking);

router
  .route('/:id/accept')
  .patch(
    validate({ params: bookingParamsSchema }),
    bookingController.acceptBooking,
  );

router
  .route('/:id/decline')
  .patch(
    validate({ params: bookingParamsSchema }),
    bookingController.declineBooking,
  );

router
  .route('/:id/cancel')
  .patch(
    validate({ params: bookingParamsSchema, body: cancelBookingSchema }),
    bookingController.cancelBooking,
  );

router
  .route('/:id/confirm')
  .patch(
    validate({ params: bookingParamsSchema }),
    bookingController.confirmSession,
  );

router
  .route('/:id/dispute')
  .patch(
    validate({ params: bookingParamsSchema }),
    bookingController.disputeBooking,
  );

router
  .route('/:id/meeting-link')
  .patch(
    validate({ params: bookingParamsSchema, body: addMeetingLinkSchema }),
    bookingController.addMeetingLink,
  );

// Admin router

export const adminBookingRouter = Router();

adminBookingRouter.use(protect, restrictTo('admin'));

adminBookingRouter.get('/stats', adminBookingController.getStats);

adminBookingRouter.get('/by-status', adminBookingController.getByStatus);

adminBookingRouter.get(
  '/disputes',
  validate({ query: adminDisputeQuerySchema }),
  adminBookingController.getDisputes,
);

adminBookingRouter.get(
  '/',
  validate({ query: adminBookingQuerySchema }),
  adminBookingController.getAllBookings,
);

adminBookingRouter.get(
  '/credit-flow',
  validate({ query: adminCreditFlowQuerySchema }),
  adminBookingController.getCreditFlow,
);

adminBookingRouter.get(
  '/overview',
  validate({ query: adminOverviewQuerySchema }),
  adminBookingController.getOverview,
);

adminBookingRouter.get(
  '/:id',
  validate({ params: bookingParamsSchema }),
  adminBookingController.getBooking,
);

export { router as bookingRouter };
