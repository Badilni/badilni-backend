import mongoose, { InferSchemaType } from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Review must belong to a booking'],
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must have a reviewer'],
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must have a reviewee'],
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

reviewSchema.pre('validate', function () {
  if (!this.isNew) {
    return;
  }
  const hasListing = this.listing !== undefined && this.listing !== null;
  const hasRequest = this.request !== undefined && this.request !== null;

  if (hasListing === hasRequest) {
    const validationError = new mongoose.Error.ValidationError();
    validationError.addError(
      'listing',
      new mongoose.Error.ValidatorError({
        message: 'Review must reference exactly one of listing or request',
        path: 'listing',
        value: this.listing,
      }),
    );
    throw validationError;
  }
});

reviewSchema.index({ booking: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ booking: 1 });
reviewSchema.index({ listing: 1 });
reviewSchema.index({ request: 1 });

export type IReview = InferSchemaType<typeof reviewSchema>;
export const Review = mongoose.model('Review', reviewSchema);
export type ReviewDocument = InstanceType<typeof Review>;
