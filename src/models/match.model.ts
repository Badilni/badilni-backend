import mongoose, { InferSchemaType } from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A match must have a provider'],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A match must have a receiver'],
    },
    providerListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillListing',
      default: null,
    },
    receiverRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      default: null,
    },
    matchScore: {
      type: Number,
      required: [true, 'Please provide a match score'],
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'notified', 'accepted', 'dismissed'],
      default: 'pending',
    },
    aiReasoning: {
      type: String,
      trim: true,
      maxlength: [500, 'AI reasoning cannot exceed 500 characters'],
    },
  },
  { timestamps: true },
);

matchSchema.index({ providerId: 1, receiverId: 1, providerListingId: 1, receiverRequestId: 1 }, { unique: true });
matchSchema.index({ status: 1, createdAt: -1 });

const sanitizeMatchOutput = (ret: Record<string, any>) => {
  delete ret.__v;
  return ret;
};

matchSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeMatchOutput(ret),
});

matchSchema.set('toObject', {
  virtuals: true,
});

export type IMatch = InferSchemaType<typeof matchSchema>;

export const Match = mongoose.model('Match', matchSchema);

export type MatchDocument = InstanceType<typeof Match>;