import { asyncHandler } from '../../utils/asyncHandler.js';
import * as notificationService from './notification.service.js';
import * as adminActionService from '../adminAction/adminAction.service.js';
import {
  NotificationParams,
  NotificationQuery,
  AdminSendNotificationInput,
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

// Admin only
export const sendAdmin = asyncHandler(async (req, res) => {
  const data = req.body as AdminSendNotificationInput;
  const result = await notificationService.sendAdminNotification(data);

  await adminActionService.logAction({
    adminId: req.user!.id,
    action: 'send_notification',
    ...(data.target === 'user' && data.userId
      ? { targetId: data.userId, targetModel: 'User' as const }
      : {}),
    details: { target: data.target, title: data.title, count: result.count },
  });

  res.status(201).json({
    status: 'success',
    data: { notification: result.notification, count: result.count },
  });
});
