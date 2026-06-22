import { Booking } from '../../models/booking.model.js';
import { Review } from '../../models/review.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import * as dbFactory from '../../utils/dbFactory.js';
import * as aiService from '../../utils/aiService.js';
import * as notificationService from '../notification/notification.service.js';
import { CreateReviewInput, ReviewQuery } from './review.schema.js';

interface CurrentUser {
  id: string;
  role?: string;
}

// Eventual-consistency recalculation of the reviewee's averageRating and
// AI-generated review summary (see Badilni plan §6.5).
const recalculateReviewee = async (revieweeId: string) => {
  const reviews = await Review.find({ revieweeId }).select('rating comment');

  if (reviews.length === 0) {
    return;
  }

  const averageRating =
    reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  await User.findByIdAndUpdate(revieweeId, { averageRating });

  try {
    const reviewSummary = await aiService.generateReviewSummary(
      reviews.map((review) => ({ rating: review.rating, comment: review.comment })),
    );

    if (reviewSummary) {
      await User.findByIdAndUpdate(revieweeId, { reviewSummary });
    }
  } catch (err) {
    console.error('Non-fatal: failed to generate AI review summary.', err);
  }
};

export const createReview = async (
  reviewerId: string,
  data: CreateReviewInput,
) => {
  const booking = await Booking.findById(data.bookingId);

  if (!booking) {
    throw new AppError('No booking found with this id', 404);
  }
  if (booking.status !== 'completed') {
    throw new AppError('You can only review completed sessions', 400);
  }

  const isReceiver = booking.receiverId.toString() === reviewerId;
  const isProvider = booking.providerId.toString() === reviewerId;

  if (!isReceiver && !isProvider) {
    throw new AppError('You are not a participant in this booking', 403);
  }

  const revieweeId = isReceiver ? booking.providerId : booking.receiverId;

  const review = await Review.create({
    bookingId: data.bookingId,
    reviewerId,
    revieweeId,
    rating: data.rating,
    comment: data.comment,
  });

  await recalculateReviewee(revieweeId.toString());

  await notificationService.create({
    userId: revieweeId.toString(),
    type: 'new_review',
    title: 'You received a new review',
    body: `You received a ${data.rating}-star review for a recent session.`,
    relatedEntityId: review._id.toString(),
    relatedEntityType: 'Review',
  });

  return review;
};

export const getReview = async (
  id: string,
  query: dbFactory.FieldSelectionOptions = {},
) => {
  const mongooseQuery = Review.findById(id)
    .populate('reviewerId', 'name avatar')
    .populate('revieweeId', 'name avatar');

  return dbFactory.findDocumentOrThrow(mongooseQuery, query);
};

export const getAllReviews = async (query: ReviewQuery) => {
  const mongooseQuery = Review.find()
    .populate('reviewerId', 'name avatar')
    .populate('revieweeId', 'name avatar');

  return dbFactory.findMany(mongooseQuery, query, ['comment']);
};

export const flagReview = async (id: string, user: CurrentUser) => {
  const filter = dbFactory.buildOwnerScopedFilter(id) as Record<string, unknown>;

  if (user.role !== 'admin') {
    return dbFactory.updateDocumentOrThrow(Review, filter, { isFlagged: true });
  }

  return dbFactory.updateDocumentOrThrow(Review, filter, { isFlagged: true });
};

export const deleteReview = async (id: string) => {
  const review = await dbFactory.deleteDocumentOrThrow(Review, { _id: id });
  await recalculateReviewee(review.revieweeId.toString());
  return review;
};