import mongoose, { QueryFilter } from 'mongoose';

import { Booking } from '../../models/booking.model.js';
import { Review, ReviewDocument } from '../../models/review.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import * as dbFactory from '../../utils/dbFactory.js';
import { notifyNewReview } from '../notification/notification.service.js';
import { BookingStatus } from '../booking/booking.types.js';
import {
  CreateReviewInput,
  ReviewQueryInput,
  UpdateReviewInput,
} from './review.schema.js';

interface CurrentUser {
  id: string;
  role?: string;
}

const REVIEW_SUMMARY_POPULATE_PATHS = [
  { path: 'reviewer', select: 'name avatar' },
  { path: 'reviewee', select: 'name avatar' },
  { path: 'listing', select: 'title' },
  { path: 'request', select: 'title' },
];

const REVIEW_DETAIL_POPULATE_PATHS = [
  ...REVIEW_SUMMARY_POPULATE_PATHS,
  { path: 'booking', select: 'scheduledAt status' },
];

const isDuplicateKeyError = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: unknown }).code === 11000;

const toObjectId = (id: mongoose.Types.ObjectId | string) =>
  new mongoose.Types.ObjectId(id.toString());

const recalculateUserRating = async (
  revieweeId: mongoose.Types.ObjectId | string,
) => {
  const result = await Review.aggregate([
    { $match: { reviewee: toObjectId(revieweeId) } },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ]);

  await User.findByIdAndUpdate(revieweeId, {
    averageRating: result[0]?.avg ?? 0,
  });
};

const recalculateListingRating = async (
  listingId?: mongoose.Types.ObjectId | string | null,
) => {
  if (!listingId) {
    return;
  }

  const listing = await SkillListing.findById(listingId).select('user');
  if (!listing) {
    return;
  }

  const result = await Review.aggregate([
    {
      $match: {
        listing: toObjectId(listingId),
        reviewee: toObjectId(listing.user),
      },
    },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ]);

  await SkillListing.findByIdAndUpdate(listingId, {
    averageRating: result[0]?.avg ?? 0,
  });
};

const logRatingRecalculationFailures = (
  results: PromiseSettledResult<unknown>[],
) => {
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(
        '[ReviewService] Failed to recalculate rating:',
        result.reason,
      );
    }
  });
};

const recalculateRatings = async (
  revieweeId: mongoose.Types.ObjectId | string,
  listingId?: mongoose.Types.ObjectId | string | null,
) => {
  const results = await Promise.allSettled([
    recalculateUserRating(revieweeId),
    recalculateListingRating(listingId),
  ]);

  logRatingRecalculationFailures(results);
};

const withRequiredPopulateFields = (
  query: Pick<
    ReviewQueryInput,
    'page' | 'limit' | 'sort' | 'fields' | 'keyword'
  >,
) => {
  if (!query.fields) {
    return query;
  }

  const requiredFields = ['reviewer', 'reviewee', 'listing', 'request'];
  const fields = new Set([
    ...query.fields.split(',').filter(Boolean),
    ...requiredFields,
  ]);

  return { ...query, fields: [...fields].join(',') };
};

export const createReview = async (
  reviewerId: string,
  data: CreateReviewInput,
) => {
  if (!data.booking) {
    throw new AppError('Booking is required to create a review', 400);
  }

  const booking = await Booking.findById(data.booking);
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    throw new AppError('Only completed bookings can be reviewed', 400);
  }

  const isProvider = booking.provider.toString() === reviewerId;
  const isReceiver = booking.receiver.toString() === reviewerId;
  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  const revieweeId = isProvider ? booking.receiver : booking.provider;

  let review: ReviewDocument;
  try {
    review = await Review.create({
      booking: booking._id,
      reviewer: reviewerId,
      reviewee: revieweeId,
      rating: data.rating,
      ...(data.comment !== undefined && { comment: data.comment }),
      ...(booking.listing && { listing: booking.listing }),
      ...(booking.request && { request: booking.request }),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('You have already reviewed this booking', 409);
    }
    throw err;
  }

  await recalculateRatings(revieweeId, booking.listing);

  await review.populate(REVIEW_SUMMARY_POPULATE_PATHS);

  notifyNewReview({
    userId: revieweeId.toString(),
    reviewerName: (review.reviewer as unknown as { name: string }).name,
    reviewId: review._id.toString(),
  });

  return review;
};

export const getReview = async (id: string) => {
  const query = Review.findById(id).populate(REVIEW_DETAIL_POPULATE_PATHS);

  return dbFactory.findDocumentOrThrow(query);
};

export const getAllReviews = async (query: ReviewQueryInput) => {
  const filter: QueryFilter<ReviewDocument> = {};

  if (query.booking) {
    filter.booking = query.booking;
  }
  if (query.listing) {
    filter.listing = query.listing;
  }
  if (query.user) {
    filter[query.type === 'given' ? 'reviewer' : 'reviewee'] = query.user;
  }
  if (query.reviewee) {
    filter.reviewee = query.reviewee;
  }
  if (query.reviewer) {
    filter.reviewer = query.reviewer;
  }

  const apiQuery = {
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    fields: query.fields,
    keyword: query.keyword,
  };

  const mongooseQuery = Review.find(filter).populate(
    REVIEW_SUMMARY_POPULATE_PATHS,
  );

  return dbFactory.findMany(
    mongooseQuery,
    withRequiredPopulateFields(apiQuery),
    ['comment'],
  );
};

export const updateReview = async (
  id: string,
  user: CurrentUser,
  data: UpdateReviewInput,
) => {
  const filter = dbFactory.buildOwnerScopedFilter(id, {
    ownerField: 'reviewer',
    user,
  }) as QueryFilter<ReviewDocument>;

  const review = await dbFactory.updateDocumentOrThrow(Review, filter, data);

  await recalculateRatings(review.reviewee, review.listing);

  await review.populate(REVIEW_SUMMARY_POPULATE_PATHS);

  return review;
};

export const deleteReview = async (id: string) => {
  const review = await dbFactory.deleteDocumentOrThrow(Review, { _id: id });

  await recalculateRatings(review.reviewee, review.listing);
};
