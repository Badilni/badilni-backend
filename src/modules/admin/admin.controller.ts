import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminService from './admin.service.js';
import { AdminBookingParams, AdminUserParams } from './admin.schema.js';

export const getDashboardStats = asyncHandler(async (req, res, _next) => {
  const stats = await adminService.getDashboardStats();
  res.status(200).json({ status: 'success', data: { stats } });
});

export const getFlaggedReviews = asyncHandler(async (req, res, _next) => {
  const { docs: reviews, pagination } = await adminService.getFlaggedReviews(
    req.query,
  );

  res.status(200).json({ status: 'success', pagination, data: { reviews } });
});

export const getDisputedBookings = asyncHandler(async (req, res, _next) => {
  const { docs: bookings, pagination } = await adminService.getDisputedBookings(
    req.query,
  );

  res.status(200).json({ status: 'success', pagination, data: { bookings } });
});

export const suspendUser = asyncHandler(async (req, res, _next) => {
  const user = await adminService.suspendUser(
    req.user!.id,
    (req.params as AdminUserParams).userId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { user } });
});

export const unsuspendUser = asyncHandler(async (req, res, _next) => {
  const user = await adminService.unsuspendUser(
    req.user!.id,
    (req.params as AdminUserParams).userId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { user } });
});

export const adjustUserCredits = asyncHandler(async (req, res, _next) => {
  const user = await adminService.adjustUserCredits(
    req.user!.id,
    (req.params as AdminUserParams).userId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { user } });
});

export const resolveDispute = asyncHandler(async (req, res, _next) => {
  const booking = await adminService.resolveDispute(
    req.user!.id,
    (req.params as AdminBookingParams).bookingId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});
