import mongoose, { InferSchemaType, Types } from 'mongoose';
import { TransactionType } from '../modules/transaction/transaction.types.js';

const transactionSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
    },
    toUserId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      required: [
        function (this: any) {
          return this.type !== TransactionType.ADMIN_ADJUSTMENT || this.fromUserId === null;
        },
        'Transaction must have a recipient',
      ] as [() => boolean, string],
    },
    amount: {
      type: Number,
      required: [true, 'Transaction must have an amount'],
      min: [0.01, 'Transaction amount must be positive'],
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, 'Transaction must have a type'],
    },
    bookingId: {
      type: Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    // Only createdAt — no updatedAt, documents are immutable
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Enforce immutability — throw if someone tries to save an existing document
transactionSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Transaction documents are immutable and cannot be updated');
  }
});

// User wallet history — most common query
transactionSchema.index({ toUserId: 1, createdAt: -1 });

// Sent credits history
transactionSchema.index({ fromUserId: 1, createdAt: -1 });

// Booking-scoped transaction lookup (dispute resolution)
transactionSchema.index({ bookingId: 1 });

export type ITransaction = InferSchemaType<typeof transactionSchema>;
export const Transaction = mongoose.model('Transaction', transactionSchema);
export type TransactionDocument = InstanceType<typeof Transaction>;
