import mongoose, { InferSchemaType } from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Match must have a provider'],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Match must have a receiver'],
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: [true, 'Match must reference a skill listing'],
    },
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: [true, 'Match must reference a service request'],
    },
    matchScore: {
      type: Number,
      required: [true, 'Match must have a score'],
      min: 0,
      max: 1,
    },
    aiReasoning: {
      type: String,
      required: [true, 'Match must include AI reasoning'],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

matchSchema.index({ listing: 1, request: 1 }, { unique: true });
matchSchema.index({ provider: 1, createdAt: -1 });
matchSchema.index({ receiver: 1, createdAt: -1 });
matchSchema.index({ request: 1, createdAt: -1 });

export type IMatch = InferSchemaType<typeof matchSchema>;
export const Match = mongoose.model('Match', matchSchema);
export type MatchDocument = InstanceType<typeof Match>;
