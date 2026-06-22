import mongoose, { InferSchemaType } from 'mongoose';

const adminActionSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An admin action must record the acting admin'],
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An admin action must have a target user'],
    },
    action: {
      type: String,
      enum: ['suspend', 'unsuspend', 'credit_adjust', 'delete_review', 'delete_listing'],
      required: [true, 'Please provide the action type'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActionSchema.index({ targetUserId: 1, createdAt: -1 });

// Audit log — immutable
adminActionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  throw new Error('AdminAction documents are immutable and cannot be updated');
});

const sanitizeAdminActionOutput = (ret: Record<string, any>) => {
  delete ret.__v;
  return ret;
};

adminActionSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => sanitizeAdminActionOutput(ret),
});

export type IAdminAction = InferSchemaType<typeof adminActionSchema>;

export const AdminAction = mongoose.model('AdminAction', adminActionSchema);

export type AdminActionDocument = InstanceType<typeof AdminAction>;