import mongoose, { InferSchemaType } from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: {
      type: String,
      enum: ['image', 'document', 'archive', 'other'],
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message must have a sender'],
    },
    body: {
      type: String,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    attachments: {
      type: [attachmentSchema],
      validate: {
        validator: (a: unknown[]) => a.length <= 5,
        message: 'Maximum 5 attachments allowed',
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    referenceType: {
      type: String,
      enum: ['SkillListing', 'ServiceRequest'],
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceType',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

messageSchema.pre('validate', function () {
  const hasConversation =
    this.conversation !== undefined && this.conversation !== null;
  const hasBooking = this.booking !== undefined && this.booking !== null;

  if (hasConversation === hasBooking) {
    const err = new mongoose.Error.ValidationError();
    err.addError(
      'conversation',
      new mongoose.Error.ValidatorError({
        message: 'Message must have exactly one of conversation or booking',
        path: 'conversation',
        value: this.conversation,
      }),
    );
    throw err;
  }

  const hasBody = Boolean(this.body?.trim());
  const hasAttachments =
    this.attachments !== undefined && this.attachments.length > 0;

  if (!hasBody && !hasAttachments) {
    const err = new mongoose.Error.ValidationError();
    err.addError(
      'body',
      new mongoose.Error.ValidatorError({
        message: 'Message must have a body or at least one attachment',
        path: 'body',
        value: this.body,
      }),
    );
    throw err;
  }

  const hasRefType =
    this.referenceType !== undefined && this.referenceType !== null;
  const hasRef = this.reference !== undefined && this.reference !== null;

  if (hasRefType !== hasRef) {
    const err = new mongoose.Error.ValidationError();
    err.addError(
      'referenceType',
      new mongoose.Error.ValidatorError({
        message: 'referenceType and reference must both be provided together',
        path: 'referenceType',
        value: this.referenceType,
      }),
    );
    throw err;
  }
});

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ booking: 1, createdAt: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isRead: 1, sender: 1 });
messageSchema.index({ booking: 1, isRead: 1, sender: 1 });

export type IMessage = InferSchemaType<typeof messageSchema>;
export const Message = mongoose.model('Message', messageSchema);
export type MessageDocument = InstanceType<typeof Message>;
