import mongoose, { InferSchemaType } from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide category name'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true },
);

categorySchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { strict: true, lower: true });
  }
});

export type ICategory = InferSchemaType<typeof categorySchema>;

export const Category = mongoose.model('Category', categorySchema);

export type CategoryDocument = InstanceType<typeof Category>;
