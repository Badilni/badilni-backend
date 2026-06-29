import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { normalizeBookingFilter } from '../../middleware/normalizeFilter.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { reviewRouter } from '../review/review.routes.js';
import * as bookingController from './booking.controller.js';
import {
  addMeetingLinkSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
} from './booking.schema.js';

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
  .get(
    validate({ params: bookingParamsSchema }),
    bookingController.getBooking,
  );

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

export { router as bookingRouter };
