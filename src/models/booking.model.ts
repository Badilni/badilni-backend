import mongoose, { InferSchemaType } from 'mongoose';
import { BookingStatus } from '../modules/booking/booking.types.js';

const bookingSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must have a provider'],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must have a receiver'],
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Booking must have a scheduled date'],
    },
    durationHours: {
      type: Number,
      required: [true, 'Booking must have a duration'],
      min: [0.5, 'Duration must be at least 0.5 hours'],
    },
    creditsTotal: {
      type: Number,
      required: [true, 'Booking must have a credits total'],
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
    },
    providerConfirmed: {
      type: Boolean,
      default: false,
    },
    receiverConfirmed: {
      type: Boolean,
      default: false,
    },
    // Exactly one of listing/request - enforced in pre-validate hook
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    // Optional fields = absent from document when not set
    meetingLink: {
      type: String,
    },
    note: {
      type: String,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    attachments: {
      type: [{ url: String, publicId: String }],
      validate: {
        validator: (a: unknown[]) => a.length <= 3,
        message: 'Maximum 3 attachments allowed',
      },
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// Pre-validate hook: exactly one of listing/request must be present
bookingSchema.pre('validate', function () {
  const hasListing = this.listing !== undefined && this.listing !== null;
  const hasRequest = this.request !== undefined && this.request !== null;

  if (hasListing === hasRequest) {
    const validationError = new mongoose.Error.ValidationError();
    validationError.addError(
      'listing',
      new mongoose.Error.ValidatorError({
        message: 'Booking must reference exactly one of listing or request',
        path: 'listing',
        value: this.listing,
      }),
    );
    throw validationError;
  }
});

// Indexes
// User's bookings filtered by status — main dashboard query
bookingSchema.index({ provider: 1, status: 1, scheduledAt: -1 });
bookingSchema.index({ receiver: 1, status: 1, scheduledAt: -1 });

// Cron job — find accepted bookings past their window
bookingSchema.index({ status: 1, scheduledAt: 1 });

// Origin reference lookups
bookingSchema.index({ listing: 1 });
bookingSchema.index({ request: 1 });

export type IBooking = InferSchemaType<typeof bookingSchema>;
export const Booking = mongoose.model('Booking', bookingSchema);
export type BookingDocument = InstanceType<typeof Booking>;
