import { asyncHandler } from '../../utils/asyncHandler.js';
import * as reviewService from './review.service.js';
import {
  CreateReviewInput,
  ReviewParamsInput,
  ReviewQueryInput,
  UpdateReviewInput,
} from './review.schema.js';

export const createReview = asyncHandler(async (req, res) => {
  const data: CreateReviewInput = {
    ...(req.body as CreateReviewInput),
    ...(!(req.body as CreateReviewInput).booking && req.query.booking
      ? { booking: req.query.booking as string }
      : {}),
  };

  const review = await reviewService.createReview(req.user!.id, data);

  res.status(201).json({
    status: 'success',
    data: { review },
  });
});

export const getReview = asyncHandler(async (req, res) => {
  const review = await reviewService.getReview(
    (req.params as unknown as ReviewParamsInput).id,
  );

  res.status(200).json({
    status: 'success',
    data: { review },
  });
});

export const getAllReviews = asyncHandler(async (req, res) => {
  const { docs: reviews, pagination } = await reviewService.getAllReviews(
    req.query as unknown as ReviewQueryInput,
  );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { reviews },
  });
});

export const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateReview(
    (req.params as unknown as ReviewParamsInput).id,
    { id: req.user!.id, role: req.user!.role },
    req.body as UpdateReviewInput,
  );

  res.status(200).json({
    status: 'success',
    data: { review },
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview((req.params as unknown as ReviewParamsInput).id);

  res.sendStatus(204);
});
