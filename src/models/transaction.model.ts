import mongoose, { InferSchemaType } from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A transaction must have a recipient'],
    },
    amount: {
      type: Number,
      required: [true, 'Please provide the transaction amount'],
      min: [1, 'Amount must be at least 1 credit'],
    },
    type: {
      type: String,
      enum: ['session_payment', 'refund', 'welcome_bonus', 'admin_adjustment'],
      required: [true, 'Please provide the transaction type'],
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ toUserId: 1, createdAt: -1 });
transactionSchema.index({ fromUserId: 1, createdAt: -1 });

// Transactions are immutable — never updated after creation
transactionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  throw new Error('Transaction documents are immutable and cannot be updated');
});

const sanitizeTransactionOutput = (ret: Record<string, any>) => {
  delete ret.__v;
  return ret;
};

transactionSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeTransactionOutput(ret),
});

transactionSchema.set('toObject', {
  virtuals: true,
});

export type ITransaction = InferSchemaType<typeof transactionSchema>;

export const Transaction = mongoose.model('Transaction', transactionSchema);

export type TransactionDocument = InstanceType<typeof Transaction>;