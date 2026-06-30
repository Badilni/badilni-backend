import { Router } from 'express';

import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as reviewController from './review.controller.js';
import {
  createReviewSchema,
  reviewParamsSchema,
  reviewQuerySchema,
  updateReviewSchema,
} from './review.schema.js';

const router = Router({ mergeParams: true });

router
  .route('/')
  .get(validate({ query: reviewQuerySchema }), reviewController.getAllReviews)
  .post(
    protect,
    validate({ body: createReviewSchema, query: reviewQuerySchema }),
    reviewController.createReview,
  );

router
  .route('/:id')
  .get(validate({ params: reviewParamsSchema }), reviewController.getReview)
  .patch(
    protect,
    validate({ params: reviewParamsSchema, body: updateReviewSchema }),
    reviewController.updateReview,
  )
  .delete(
    protect,
    restrictTo('admin'),
    validate({ params: reviewParamsSchema }),
    reviewController.deleteReview,
  );

export { router as reviewRouter };
