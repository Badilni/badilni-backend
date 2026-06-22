import { Router } from 'express';

import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as reviewController from './review.controller.js';
import {
  createReviewSchema,
  reviewParamsSchema,
  reviewQuerySchema,
} from './review.schema.js';

const router = Router({ mergeParams: true });

router
  .route('/')
  .get(validate({ query: reviewQuerySchema }), reviewController.getAllReviews)
  .post(
    protect,
    validate({ body: createReviewSchema }),
    reviewController.createReview,
  );

router.get(
  '/:id',
  validate({ params: reviewParamsSchema }),
  reviewController.getReview,
);

router.patch(
  '/:id/flag',
  protect,
  validate({ params: reviewParamsSchema }),
  reviewController.flagReview,
);

router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate({ params: reviewParamsSchema }),
  reviewController.deleteReview,
);

export { router as reviewRouter };