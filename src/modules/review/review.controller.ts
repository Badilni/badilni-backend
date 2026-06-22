import { asyncHandler } from '../../utils/asyncHandler.js';
import * as reviewService from './review.service.js';
import { ReviewParams, ReviewQuery } from './review.schema.js';

export const createReview = asyncHandler(async (req, res, _next) => {
  const review = await reviewService.createReview(req.user!.id, req.body);
  res.status(201).json({ status: 'success', data: { review } });
});

export const getReview = asyncHandler(async (req, res, _next) => {
  const review = await reviewService.getReview(
    (req.params as ReviewParams).id,
    req.query,
  );

  res.status(200).json({ status: 'success', data: { review } });
});

export const getAllReviews = asyncHandler(async (req, res, _next) => {
  const { docs: reviews, pagination } = await reviewService.getAllReviews(
    req.query as unknown as ReviewQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { reviews },
  });
});

export const flagReview = asyncHandler(async (req, res, _next) => {
  const review = await reviewService.flagReview(
    (req.params as ReviewParams).id,
    req.user!,
  );

  res.status(200).json({ status: 'success', data: { review } });
});

export const deleteReview = asyncHandler(async (req, res, _next) => {
  await reviewService.deleteReview((req.params as ReviewParams).id);
  res.sendStatus(204);
});