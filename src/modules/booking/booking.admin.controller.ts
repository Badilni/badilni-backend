import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminBookingService from './booking.admin.service.js';
import {
  AdminBookingQueryInput,
  AdminCreditFlowQueryInput,
  AdminDisputeQueryInput,
  AdminOverviewQueryInput,
  ResolveDisputeInput,
} from './booking.admin.schema.js';

export const getStats = asyncHandler(async (_req, res) => {
  const stats = await adminBookingService.getStats();
  res.status(200).json({ status: 'success', data: { stats } });
});

export const getOverview = asyncHandler(async (req, res) => {
  const { days } = req.query as unknown as AdminOverviewQueryInput;
  const data = await adminBookingService.getOverview(days);
  res.status(200).json({ status: 'success', data: { overview: data } });
});

export const getByStatus = asyncHandler(async (_req, res) => {
  const data = await adminBookingService.getByStatus();
  res.status(200).json({ status: 'success', data: { byStatus: data } });
});

export const getCreditFlow = asyncHandler(async (req, res) => {
  const { days } = req.query as unknown as AdminCreditFlowQueryInput;
  const data = await adminBookingService.getCreditFlow(days);
  res.status(200).json({ status: 'success', data: { creditFlow: data } });
});

export const getDisputes = asyncHandler(async (req, res) => {
  const result = await adminBookingService.getDisputes(
    req.query as unknown as AdminDisputeQueryInput,
  );
  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { bookings: result.bookings },
  });
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const result = await adminBookingService.getAllBookingsAdmin(
    req.query as unknown as AdminBookingQueryInput,
  );
  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { bookings: result.bookings },
  });
});

export const getBooking = asyncHandler(async (req, res) => {
  const { id } = req.params as unknown as { id: string };
  const result = await adminBookingService.getBookingAdmin(id);
  res.status(200).json({ status: 'success', data: result });
});

export const resolveDispute = asyncHandler(async (req, res) => {
  const { id } = req.params as unknown as { id: string };
  const booking = await adminBookingService.resolveDispute(
    id,
    req.user!.id,
    req.body as ResolveDisputeInput,
  );
  res.status(200).json({ status: 'success', data: { booking } });
});