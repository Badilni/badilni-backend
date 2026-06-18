import mongoose, { InferSchemaType } from 'mongoose';

const baseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A document must belong to a user'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'A document must belong to a category'],
    },
    title: {
      type: String,
      required: [true, 'Please provide a title'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    tags: {
      type: [String],
      validate: {
        validator: (tags: string[]) => tags.length >= 1 && tags.length <= 8,
        message: 'Must have between 1 and 8 tags',
      },
    },
    embedding: {
      type: [Number],
      select: false,
    },
  },
  {
    timestamps: true,
    discriminatorKey: 'type',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        delete ret.embedding;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

baseSchema.index({ type: 1, userId: 1 });
baseSchema.index({ type: 1, categoryId: 1 });
baseSchema.index({ type: 1, tags: 1 });

export const Listing = mongoose.model('Listing', baseSchema);
export type IListing = InferSchemaType<typeof baseSchema>;
