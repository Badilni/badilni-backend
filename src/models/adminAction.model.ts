import mongoose, { InferSchemaType, Types } from 'mongoose';
import {
  AdminActionType,
  AdminActionTargetModel,
} from '../modules/admin/admin.types.js';

const adminActionSchema = new mongoose.Schema(
  {
    admin: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin action must belong to an admin'],
    },
    action: {
      type: String,
      enum: [
        'suspend',
        'unsuspend',
        'delete',
        'credit_adjust',
        'resolve_dispute',
        'create_category',
        'update_category',
        'delete_category',
        'send_notification',
      ] satisfies AdminActionType[],
      required: [true, 'Admin action must have an action type'],
    },
    targetId: {
      type: Types.ObjectId,
      default: null,
    },
    targetModel: {
      type: String,
      enum: [
        'User',
        'Category',
        'Booking',
        'Transaction',
        'Notification',
      ] satisfies AdminActionTargetModel[],
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    // Only createdAt — no updatedAt, audit log entries are immutable
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Enforce immutability — throw if someone tries to save an existing document
adminActionSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Admin action logs are immutable and cannot be updated');
  }
});

// Full history query, most recent first
adminActionSchema.index({ createdAt: -1 });
// Filter by action type
adminActionSchema.index({ action: 1, createdAt: -1 });
// Filter by acting admin
adminActionSchema.index({ admin: 1, createdAt: -1 });
// Look up all actions taken against a specific target
adminActionSchema.index({ targetId: 1 });

export type IAdminAction = InferSchemaType<typeof adminActionSchema>;
export const AdminAction = mongoose.model('AdminAction', adminActionSchema);
export type AdminActionDocument = InstanceType<typeof AdminAction>;