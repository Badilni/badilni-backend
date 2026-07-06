import { asyncHandler } from '../../utils/asyncHandler.js';
import * as messageService from './message.service.js';
import {
  BookingChatParams,
  ConversationParams,
  InboxQuery,
  MessageQuery,
  SendConversationMessageInput,
  SendBookingMessageInput,
  SendConversationParams,
} from './message.schema.js';

export const sendConversationMessage = asyncHandler(async (req, res) => {
  const { recipientId } = req.params as unknown as SendConversationParams;
  const message = await messageService.sendConversationMessage(
    req.user!.id,
    recipientId,
    req.body as SendConversationMessageInput,
    req.files as Express.Multer.File[] | undefined,
  );
  res.status(201).json({ status: 'success', data: { message } });
});

export const sendBookingMessage = asyncHandler(async (req, res) => {
  const { bookingId } = req.params as unknown as BookingChatParams;
  const message = await messageService.sendBookingMessage(
    req.user!.id,
    bookingId,
    req.body as SendBookingMessageInput,
    req.files as Express.Multer.File[] | undefined,
  );
  res.status(201).json({ status: 'success', data: { message } });
});

export const getConversations = asyncHandler(async (req, res) => {
  const result = await messageService.getInbox(
    req.user!.id,
    req.query as unknown as InboxQuery,
  );
  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { conversations: result.conversations },
  });
});

export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params as unknown as ConversationParams;
  const result = await messageService.getConversationMessages(
    conversationId,
    req.user!.id,
    req.query as unknown as MessageQuery,
  );
  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { messages: result.messages },
  });
});

export const getBookingMessages = asyncHandler(async (req, res) => {
  const { bookingId } = req.params as unknown as BookingChatParams;
  const result = await messageService.getBookingMessages(
    bookingId,
    req.user!.id,
    req.user!.role,
    req.query as unknown as MessageQuery,
  );
  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { messages: result.messages },
  });
});

export const markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params as unknown as ConversationParams;
  await messageService.markConversationAsRead(conversationId, req.user!.id);
  res.sendStatus(204);
});

export const markBookingThreadAsRead = asyncHandler(async (req, res) => {
  const { bookingId } = req.params as unknown as BookingChatParams;
  await messageService.markBookingAsRead(bookingId, req.user!.id);
  res.sendStatus(204);
});

export const getUnreadConversationCount = asyncHandler(async (req, res) => {
  const count = await messageService.getUnreadConversationCount(req.user!.id);
  res.status(200).json({ status: 'success', data: { unreadCount: count } });
});
