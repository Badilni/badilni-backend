import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { fieldSelectionQuerySchema } from '../../utils/common.schema.js';
import * as bookingController from './booking.controller.js';
import {
  acceptBookingSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  disputeBookingSchema,
} from './booking.schema.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(validate({ query: bookingQuerySchema }), bookingController.getAllBookings)
  .post(validate({ body: createBookingSchema }), bookingController.createBooking);

router.get(
  '/:id',
  validate({ params: bookingParamsSchema, query: fieldSelectionQuerySchema }),
  bookingController.getBooking,
);

router.patch(
  '/:id/accept',
  validate({ params: bookingParamsSchema, body: acceptBookingSchema }),
  bookingController.acceptBooking,
);

router.patch(
  '/:id/decline',
  validate({ params: bookingParamsSchema }),
  bookingController.declineBooking,
);

router.patch(
  '/:id/confirm',
  validate({ params: bookingParamsSchema }),
  bookingController.confirmBooking,
);

router.patch(
  '/:id/cancel',
  validate({ params: bookingParamsSchema, body: cancelBookingSchema }),
  bookingController.cancelBooking,
);

router.patch(
  '/:id/dispute',
  validate({ params: bookingParamsSchema, body: disputeBookingSchema }),
  bookingController.disputeBooking,
);

export { router as bookingRouter };
