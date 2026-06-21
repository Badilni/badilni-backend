import mongoose from 'mongoose';
import { Listing } from './listing.model.js';

const serviceRequestSchema = new mongoose.Schema({
  creditsOffered: {
    type: Number,
    required: [true, 'Please provide the credits you are offering'],
    min: [1, 'Must offer at least 1 credit'],
  },
  deadline: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['open', 'matched', 'fulfilled', 'expired'],
    default: 'open',
  },
  referenceImages: {
    type: [{ url: String, publicId: String }],
    validate: {
      validator: (imgs: unknown[]) => imgs.length <= 5,
      message: 'Maximum 5 reference images',
    },
  },
});

export const ServiceRequest = Listing.discriminator(
  'ServiceRequest',
  serviceRequestSchema,
);
export type ServiceRequestDocument = InstanceType<typeof ServiceRequest>;
