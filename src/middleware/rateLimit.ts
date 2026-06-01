import expressRateLimit from 'express-rate-limit';

import { AppError } from '../utils/appError.js';

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

    handler: (_req, _res, next) => {
      next(new AppError(currentOption.message, 429));
    },
  });
};
