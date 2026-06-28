import { asyncHandler } from '../../utils/asyncHandler.js';
import * as bookingService from './booking.service.js';
import {
  CreateBookingInput,
  CancelBookingInput,
  AddMeetingLinkInput,
  BookingParamsInput,
  BookingQueryInput,
} from './booking.schema.js';

export const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(
    req.user!.id,
    req.user!.name,
    req.body as CreateBookingInput,
    req.files as Express.Multer.File[] | undefined,
  );

  res.status(201).json({
    status: 'success',
    data: { booking },
  });
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const result = await bookingService.getAllBookings(
    req.user!.id,
    req.query as unknown as BookingQueryInput,
  );

  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { bookings: result.bookings },
  });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBooking(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const acceptBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.acceptBooking(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
    req.user!.name,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const declineBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.declineBooking(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
    req.user!.name,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
    req.user!.name,
    req.body as CancelBookingInput,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const confirmSession = asyncHandler(async (req, res) => {
  const booking = await bookingService.confirmSession(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const disputeBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.disputeBooking(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
    req.user!.name,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

export const addMeetingLink = asyncHandler(async (req, res) => {
  const booking = await bookingService.addMeetingLink(
    (req.params as unknown as BookingParamsInput).id,
    req.user!.id,
    req.body as AddMeetingLinkInput,
  );

  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});
