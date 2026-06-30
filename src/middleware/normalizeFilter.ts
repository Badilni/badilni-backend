import { RequestHandler } from 'express';

export const normalizeUserFilter: RequestHandler = (req, res, next) => {
  if (req.params.userId) {
    req.query.user = req.params.userId;
  } else if (req.originalUrl.includes('/me') && req.user) {
    req.query.user = req.user.id;
  }

  next();
};

export const normalizeListingFilter: RequestHandler = (req, _res, next) => {
  if (req.params.listingId) {
    req.query.listing = req.params.listingId;
  }

  next();
};

export const normalizeBookingFilter: RequestHandler = (req, _res, next) => {
  if (req.params.bookingId) {
    req.query.booking = req.params.bookingId;
  }

  next();
};
