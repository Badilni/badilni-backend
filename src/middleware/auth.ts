import jwt, { type JwtPayload } from 'jsonwebtoken';
import { RequestHandler } from 'express';

import { User } from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers?.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access', 401),
    );
  }

  const decoded = jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET!,
  ) as JwtPayload & { id: string; email: string };

  const user = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!user) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exists',
        401,
      ),
    );
  }

  if (typeof decoded.iat !== 'number') {
    return next(new AppError('Invalid token', 401));
  }

  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  req.user = user;
  next();
});

export const restrictTo =
  (...roles: ('user' | 'admin')[]): RequestHandler =>
  (req, res, next) => {
    if (!roles.includes(req.user!.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };
