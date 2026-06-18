import mongoose from 'mongoose';
import { Listing } from './listing.model.js';

const skillListingSchema = new mongoose.Schema({
  hourlyRate: {
    type: Number,
    required: [true, 'Please provide an hourly credit rate'],
    min: [1, 'Hourly rate must be at least 1 credit'],
    max: [20, 'Hourly rate cannot exceed 20 credits'],
  },
  availabilityNotes: {
    type: String,
    trim: true,
    maxlength: [300, 'Availability notes cannot exceed 300 characters'],
  },
  sampleWork: {
    type: [{ url: String, publicId: String }],
    validate: {
      validator: (s: unknown[]) => s.length <= 5,
      message: 'Maximum 5 sample work items',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: (val: number) => Math.round(val * 10) / 10,
  },
  totalBookings: {
    type: Number,
    default: 0,
    min: 0,
  },
});

export const SkillListing = Listing.discriminator(
  'SkillListing',
  skillListingSchema,
);
export type SkillListingDocument = InstanceType<typeof SkillListing>;
