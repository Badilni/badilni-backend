import { asyncHandler } from '../../utils/asyncHandler.js';
import * as bookingService from './booking.service.js';
import { BookingParams, BookingQuery } from './booking.schema.js';

export const createBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.createBooking(req.user!.id, req.body);
  res.status(201).json({ status: 'success', data: { booking } });
});

export const getBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.getBooking(
    (req.params as BookingParams).id,
    req.user!,
    req.query,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});

export const getAllBookings = asyncHandler(async (req, res, _next) => {
  const { docs: bookings, pagination } = await bookingService.getAllBookings(
    req.user!,
    req.query as unknown as BookingQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { bookings },
  });
});

export const acceptBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.acceptBooking(
    (req.params as BookingParams).id,
    req.user!,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});

export const declineBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.declineBooking(
    (req.params as BookingParams).id,
    req.user!,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});

export const confirmBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.confirmBooking(
    (req.params as BookingParams).id,
    req.user!,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});

export const cancelBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.cancelBooking(
    (req.params as BookingParams).id,
    req.user!,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});

export const disputeBooking = asyncHandler(async (req, res, _next) => {
  const booking = await bookingService.disputeBooking(
    (req.params as BookingParams).id,
    req.user!,
    req.body,
  );

  res.status(200).json({ status: 'success', data: { booking } });
});
