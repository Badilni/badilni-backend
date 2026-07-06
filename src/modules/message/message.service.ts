import mongoose, { Types } from 'mongoose';
import { Conversation } from '../../models/conversation.model.js';
import { Message } from '../../models/message.model.js';
import { emitToUser } from '../../socket/socket.js';
import { SOCKET_EVENTS } from '../../socket/socket.types.js';
import { AppError } from '../../utils/appError.js';
import { uploadImage } from '../../utils/cloudinary.js';
import { resolveFileType } from './message.types.js';
import {
  SendConversationMessageInput,
  SendBookingMessageInput,
  MessageQuery,
  InboxQuery,
} from './message.schema.js';

// Helpers

const buildParticipantsKey = (a: string, b: string): string =>
  [a, b].sort().join('_');

const uploadAttachments = async (files: Express.Multer.File[]) =>
  Promise.all(
    files.map(async (file) => {
      const result = await uploadImage(file, 'message-attachments');
      return {
        url: result.secure_url,
        publicId: result.public_id,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: resolveFileType(file.mimetype),
      };
    }),
  );

const toMessagePayload = (message: any) => ({
  _id: message._id.toString(),
  conversation: message.conversation?.toString(),
  booking: message.booking?.toString(),
  sender: message.sender?._id?.toString?.() ?? message.sender.toString(),
  body: message.body,
  attachments: message.attachments,
  isRead: false,
  referenceType: message.referenceType,
  reference: message.reference
    ? {
        _id: message.reference._id.toString(),
        title: message.reference.title,
      }
    : undefined,
  createdAt: message.createdAt.toISOString(),
});

// Conversation

export const getOrCreateConversation = async (
  userAId: string,
  userBId: string,
) => {
  const participantsKey = buildParticipantsKey(userAId, userBId);

  return Conversation.findOneAndUpdate(
    { participantsKey },
    {
      $setOnInsert: {
        participants: [
          new Types.ObjectId(userAId),
          new Types.ObjectId(userBId),
        ],
        participantsKey,
        unreadCounts: { [userAId]: 0, [userBId]: 0 },
        lastActivityAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
};

// Send message

export const sendBookingMessage = async (
  senderId: string,
  bookingId: string,
  data: SendBookingMessageInput,
  files?: Express.Multer.File[],
) => {
  const { Booking } = await import('../../models/booking.model.js');
  const bookingDoc =
    await Booking.findById(bookingId).select('provider receiver');

  if (!bookingDoc) {
    throw new AppError('Booking not found', 404);
  }

  const isProvider = bookingDoc.provider.toString() === senderId;
  const isReceiver = bookingDoc.receiver.toString() === senderId;

  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  const attachments = files?.length
    ? await uploadAttachments(files)
    : undefined;

  const recipientId = isProvider
    ? bookingDoc.receiver.toString()
    : bookingDoc.provider.toString();

  const message = await Message.create({
    booking: bookingId,
    sender: senderId,
    ...(data.body && { body: data.body }),
    ...(attachments?.length && { attachments }),
  });

  emitToUser(recipientId, SOCKET_EVENTS.MESSAGE_NEW, toMessagePayload(message));

  return message;
};

export const sendConversationMessage = async (
  senderId: string,
  recipientId: string,
  data: SendConversationMessageInput,
  files?: Express.Multer.File[],
) => {
  if (senderId === recipientId) {
    throw new AppError('You cannot send a message to yourself', 400);
  }

  const attachments = files?.length
    ? await uploadAttachments(files)
    : undefined;

  const session = await mongoose.startSession();
  let created: any;

  try {
    await session.withTransaction(async () => {
      const conversation = await getOrCreateConversation(senderId, recipientId);

      const [message] = await Message.create(
        [
          {
            conversation: conversation._id,
            sender: senderId,
            ...(data.body && { body: data.body }),
            ...(attachments?.length && { attachments }),
            ...(data.referenceType && { referenceType: data.referenceType }),
            ...(data.reference && {
              reference: new Types.ObjectId(data.reference),
            }),
          },
        ],
        { session },
      );

      created = message;

      const previewText = data.body
        ? data.body.length > 100
          ? `${data.body.slice(0, 97)}...`
          : data.body
        : '📎 Attachment';

      await Conversation.findByIdAndUpdate(
        conversation._id,
        {
          lastMessage: {
            body: previewText,
            sender: new Types.ObjectId(senderId),
            createdAt: new Date(),
          },
          lastActivityAt: new Date(),
          $inc: { [`unreadCounts.${recipientId}`]: 1 },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (created) {
    await created.populate([{ path: 'reference', select: 'title' }]);
  }

  emitToUser(recipientId, SOCKET_EVENTS.MESSAGE_NEW, toMessagePayload(created));

  return created;
};

// Get messages

export const getConversationMessages = async (
  conversationId: string,
  userId: string,
  query: MessageQuery,
) => {
  const conversation =
    await Conversation.findById(conversationId).select('participants');

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  const isParticipant = conversation.participants.some(
    (p: any) => p.toString() === userId,
  );

  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403);
  }

  const filter = { conversation: conversationId };
  const skip = (query.page - 1) * query.limit;

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('reference', 'title')
      .select('-__v')
      .lean(),
    Message.countDocuments(filter),
  ]);

  messages.reverse();

  return {
    messages,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
};

export const getBookingMessages = async (
  bookingId: string,
  userId: string,
  userRole: 'user' | 'admin',
  query: MessageQuery,
) => {
  const { Booking } = await import('../../models/booking.model.js');

  const booking = await Booking.findById(bookingId).select('provider receiver');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (userRole !== 'admin') {
    const isProvider = booking.provider.toString() === userId;
    const isReceiver = booking.receiver.toString() === userId;

    if (!isProvider && !isReceiver) {
      throw new AppError('You are not a party to this booking', 403);
    }
  }

  const filter = { booking: bookingId };
  const skip = (query.page - 1) * query.limit;

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('reference', 'title')
      .select('-__v')
      .lean(),
    Message.countDocuments(filter),
  ]);

  messages.reverse();

  return {
    messages,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
};

// Inbox

export const getInbox = async (userId: string, query: InboxQuery) => {
  const skip = (query.page - 1) * query.limit;

  const [conversations, total] = await Promise.all([
    Conversation.find({ participants: userId })
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('participants', 'name avatar'),
    Conversation.countDocuments({ participants: userId }),
  ]);

  const enriched = conversations.map((conv) => ({
    ...conv.toJSON(),
    unreadCount: conv.unreadCounts.get(userId) ?? 0,
  }));

  return {
    conversations: enriched,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
};

// Mark as read

export const markConversationAsRead = async (
  conversationId: string,
  userId: string,
) => {
  const conversation =
    await Conversation.findById(conversationId).select('participants');

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  const isParticipant = conversation.participants.some(
    (p: any) => p.toString() === userId,
  );

  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: new Types.ObjectId(userId) },
          isRead: false,
        },
        { isRead: true },
        { session },
      );

      await Conversation.findByIdAndUpdate(
        conversationId,
        { $set: { [`unreadCounts.${userId}`]: 0 } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const otherId = conversation.participants
    .find((p) => p.toString() !== userId)
    ?.toString();

  if (otherId) {
    emitToUser(otherId, SOCKET_EVENTS.MESSAGE_READ, {
      conversation: conversationId,
      readBy: userId,
    });
  }
};

export const markBookingAsRead = async (bookingId: string, userId: string) => {
  const { Booking } = await import('../../models/booking.model.js');

  const bookingDoc =
    await Booking.findById(bookingId).select('provider receiver');

  if (!bookingDoc) {
    throw new AppError('Booking not found', 404);
  }

  const isProvider = bookingDoc.provider.toString() === userId;
  const isReceiver = bookingDoc.receiver.toString() === userId;

  if (!isProvider && !isReceiver) {
    throw new AppError('You are not a party to this booking', 403);
  }

  await Message.updateMany(
    {
      booking: bookingId,
      sender: { $ne: new Types.ObjectId(userId) },
      isRead: false,
    },
    { isRead: true },
  );

  const otherId =
    bookingDoc.provider.toString() === userId
      ? bookingDoc.receiver.toString()
      : bookingDoc.provider.toString();

  emitToUser(otherId, SOCKET_EVENTS.MESSAGE_READ, {
    booking: bookingId,
    readBy: userId,
  });
};

// Unread count

export const getUnreadConversationCount = async (
  userId: string,
): Promise<number> => {
  const result = await Conversation.aggregate([
    {
      $match: { participants: new Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        count: {
          $sum: {
            $cond: [
              {
                $gt: [
                  {
                    $ifNull: [
                      { $getField: { field: userId, input: '$unreadCounts' } },
                      0,
                    ],
                  },
                  0,
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return result[0]?.count ?? 0;
};

export const getBookingUnreadCounts = async (
  userId: string,
  bookingIds: string[],
): Promise<Map<string, number>> => {
  const result = await Message.aggregate([
    {
      $match: {
        booking: { $in: bookingIds.map((id) => new Types.ObjectId(id)) },
        sender: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
    },
    {
      $group: {
        _id: '$booking',
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = new Map<string, number>();
  for (const item of result) {
    counts.set(item._id.toString(), item.count);
  }
  return counts;
};
