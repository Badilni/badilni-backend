import { buildConversationId, Message } from '../../models/message.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import { emitToUser } from '../../utils/socket.js';
import * as notificationService from '../notification/notification.service.js';
import { MessageQuery, SendMessageInput } from './message.schema.js';

export const sendMessage = async (
  senderId: string,
  data: SendMessageInput,
) => {
  const conversationId = buildConversationId(senderId, data.recipientId);

  const message = await Message.create({
    conversationId,
    senderId,
    recipientId: data.recipientId,
    body: data.body,
  });

  emitToUser(data.recipientId, 'message', message.toJSON());

  await notificationService.create({
    userId: data.recipientId,
    type: 'new_message',
    title: 'New message',
    body: 'You received a new message.',
    relatedEntityId: message._id.toString(),
    relatedEntityType: 'Message',
  });

  return message;
};

export const getConversations = async (userId: string) => {
  // Aggregate the latest message per conversation the user participates in.
  return Message.aggregate([
    { $match: { $or: [{ senderId: userId }, { recipientId: userId }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);
};

export const getConversationMessages = async (
  currentUserId: string,
  otherUserId: string,
  query: MessageQuery,
) => {
  const conversationId = buildConversationId(currentUserId, otherUserId);

  const mongooseQuery = Message.find({ conversationId }).sort('createdAt');

  await Message.updateMany(
    { conversationId, recipientId: currentUserId, isRead: false },
    { isRead: true },
  );

  return dbFactory.findMany(mongooseQuery, { ...query, sort: 'createdAt' }, []);
};
