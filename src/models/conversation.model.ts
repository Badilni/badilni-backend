import mongoose, { InferSchemaType } from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (arr: mongoose.Schema.Types.ObjectId[]) => arr.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
      required: true,
    },
    participantsKey: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessage: {
      body: { type: String, default: '' },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      createdAt: { type: Date, default: null },
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
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

conversationSchema.index({ participants: 1, lastActivityAt: -1 });

export type IConversation = InferSchemaType<typeof conversationSchema>;
export const Conversation = mongoose.model('Conversation', conversationSchema);
export type ConversationDocument = InstanceType<typeof Conversation>;
