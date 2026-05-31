import jwt, { type JwtPayload } from 'jsonwebtoken';
import expressRateLimit from 'express-rate-limit';

import { User } from '../../models/user.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/appError.js';
import { createSendTokens } from '../../utils/createSendTokens.js';
import { RequestHandler, Response } from 'express';

import * as authService from './auth.service.js';

const delayedResponse = (res: Response, message: string, statusCode = 200) =>
  setTimeout(
    () => res.status(statusCode).json({ status: 'success', message }),
    Math.floor(Math.random() * 701) + 2000,
  );

export const signUp = asyncHandler(async (req, res, _next) => {
  const { emailSent } = await authService.signup(req.body);

  const unifiedMessage =
    'If the email provided is valid, a verification code has been sent.';

  if (!emailSent) {
    return delayedResponse(res, unifiedMessage, 201);
  }

  res.status(201).json({
    status: 'success',
    message: 'Please check your email for the verification code.',
  });
});

export const verifyEmail = asyncHandler(async (req, res, _next) => {
  const user = await authService.verifyEmail(req.body);
  await createSendTokens(user, 200, res);
});

export const resendVerificationCode = asyncHandler(async (req, res, _next) => {
  const { emailSent } = await authService.resendVerificationCode(req.body);

  const unifiedMessage =
    'If an unverified account with that email exists, a new verification code has been sent.';

  if (!emailSent) {
    return delayedResponse(res, unifiedMessage);
  }

  res.status(200).json({
    status: 'success',
    message:
      'If an unverified account with that email exists, a new verification code has been sent.',
  });
});

export const login = asyncHandler(async (req, res, _next) => {
  const user = await authService.login(req.body);
  await createSendTokens(user, 200, res);
});

export const logout = asyncHandler(async (req, res, _next) => {
  await authService.logout(req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.clearCookie('accessToken');
  res.status(200).json({ status: 'success' });
});

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

export const forgotPassword = asyncHandler(async (req, res, _next) => {
  const { emailSent } = await authService.forgotPassword(req.body);

  const unifiedMessage =
    'If an account with that email exists, a password reset code has been sent.';

  if (!emailSent) {
    return delayedResponse(res, unifiedMessage);
  }

  res.status(200).json({
    status: 'success',
    message: unifiedMessage,
  });
});

export const resetPassword = asyncHandler(async (req, res, _next) => {
  const user = await authService.resetPassword(req.body);
  await createSendTokens(user, 200, res);
});

export const updatePassword = asyncHandler(async (req, res, _next) => {
  const user = await authService.updatePassword(req.user!.id, req.body);
  await createSendTokens(user, 200, res);
});

type RateLimitOperations =
  | 'login'
  | 'forgot'
  | 'reset'
  | 'verify'
  | 'resend'
  | 'refresh'
  | 'global';

export const rateLimit = (operation: RateLimitOperations) => {
  const retryAfter = (windowMs: number) => {
    const minutes = windowMs / (60 * 1000);
    if (minutes === 60) {
      return 'in an hour';
    }
    if (minutes === 1) {
      return 'in 1 minute';
    }
    return `in ${minutes} minutes`;
  };

  const options = (max: number, windowMs: number, action: string) => ({
    max,
    windowMs,
    message: `Too many ${action}. Please try again ${retryAfter(windowMs)}`,
  });

  const operationOptions = {
    login: options(5, 15 * 60 * 1000, 'login attempts'),
    forgot: options(5, 15 * 60 * 1000, 'password reset requests'),
    reset: options(5, 15 * 60 * 1000, 'password reset requests'),
    verify: options(5, 15 * 60 * 1000, 'verification attempts'),
    resend: options(3, 15 * 60 * 1000, 'resend verification requests'),
    refresh: options(2, 15 * 60 * 1000, 'refresh token requests'),
    global: options(100, 60 * 60 * 1000, 'requests from this IP'),
  };
  const currentOption = operationOptions[operation];

  if (!currentOption) {
    throw new Error(`Rate limit operation '${operation}' is not defined.`);
  }
  return expressRateLimit({
    max: currentOption.max,
    windowMs: currentOption.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },

    keyGenerator: (req, _res) => {
      const email = req.body?.email || '';
      return `${req.ip}-${email}`;
    },

    handler: (req, res, next) => {
      next(new AppError(currentOption.message, 429));
    },
  });
};

export const refreshToken = asyncHandler(async (req, res, _next) => {
  const user = await authService.refreshTokens(req.cookies.refreshToken);
  await createSendTokens(user, 200, res);
});
