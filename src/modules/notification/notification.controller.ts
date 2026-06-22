import { asyncHandler } from '../../utils/asyncHandler.js';
import * as notificationService from './notification.service.js';
import { NotificationParams, NotificationQuery } from './notification.schema.js';

export const getMyNotifications = asyncHandler(async (req, res, _next) => {
  const { docs: notifications, pagination } =
    await notificationService.getMyNotifications(
      req.user!.id,
      req.query as unknown as NotificationQuery,
    );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { notifications },
  });
});

export const getUnreadCount = asyncHandler(async (req, res, _next) => {
  const count = await notificationService.getUnreadCount(req.user!.id);
  res.status(200).json({ status: 'success', data: { count } });
});

export const markAsRead = asyncHandler(async (req, res, _next) => {
  const notification = await notificationService.markAsRead(
    (req.params as NotificationParams).id,
    req.user!.id,
  );

  res.status(200).json({ status: 'success', data: { notification } });
});

export const markAllAsRead = asyncHandler(async (req, res, _next) => {
  await notificationService.markAllAsRead(req.user!.id);
  res.sendStatus(204);
});
