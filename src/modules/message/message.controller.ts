import { asyncHandler } from '../../utils/asyncHandler.js';
import * as messageService from './message.service.js';
import { ConversationParams, MessageQuery } from './message.schema.js';

export const sendMessage = asyncHandler(async (req, res, _next) => {
  const message = await messageService.sendMessage(req.user!.id, req.body);
  res.status(201).json({ status: 'success', data: { message } });
});

export const getConversations = asyncHandler(async (req, res, _next) => {
  const conversations = await messageService.getConversations(req.user!.id);
  res.status(200).json({ status: 'success', data: { conversations } });
});

export const getConversationMessages = asyncHandler(async (req, res, _next) => {
  const { docs: messages, pagination } =
    await messageService.getConversationMessages(
      req.user!.id,
      (req.params as ConversationParams).userId,
      req.query as unknown as MessageQuery,
    );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { messages },
  });
});
