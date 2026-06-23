import { asyncHandler } from '../../utils/asyncHandler.js';
import * as notificationService from './notification.service.js';
import {
  NotificationParams,
  NotificationQuery,
} from './notification.schema.js';

export const getAll = asyncHandler(async (req, res) => {
  const result = await notificationService.getAll(
    req.user!.id,
    req.query as unknown as NotificationQuery,
  );

  res.status(200).json({
    status: 'success',
    unreadCount: result.unreadCount,
    pagination: result.pagination,
    data: { notifications: result.notifications },
  });
});

export const markAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAsRead(
    (req.params as NotificationParams).id,
    req.user!.id,
  );

  res.status(200).json({ status: 'success', data: null });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user!.id);

  res.status(200).json({ status: 'success', data: null });
});

export const deleteOne = asyncHandler(async (req, res) => {
  await notificationService.deleteOne(
    (req.params as NotificationParams).id,
    req.user!.id,
  );

  res.sendStatus(204);
});
