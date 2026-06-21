import { RequestHandler } from 'express';

export const normalizeUserFilter: RequestHandler = (req, res, next) => {
  if (req.params.userId) {
    req.query.user = req.params.userId;
  } else if (req.originalUrl.includes('/me') && req.user) {
    req.query.user = req.user.id;
  }

  next();
};
