import mongoose, { InferSchemaType } from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'A review must belong to a booking'],
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A review must have a reviewer'],
    },
    revieweeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A review must have a reviewee'],
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    aiSentimentFlag: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: null,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ bookingId: 1, reviewerId: 1 }, { unique: true });
reviewSchema.index({ revieweeId: 1, createdAt: -1 });

const sanitizeReviewOutput = (ret: Record<string, any>) => {
  delete ret.__v;
  return ret;
};

reviewSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeReviewOutput(ret),
});

reviewSchema.set('toObject', {
  virtuals: true,
});

export type IReview = InferSchemaType<typeof reviewSchema>;

export const Review = mongoose.model('Review', reviewSchema);

export type ReviewDocument = InstanceType<typeof Review>;