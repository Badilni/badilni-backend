import crypto from 'crypto';

import jwt, { type JwtPayload } from 'jsonwebtoken';
import expressRateLimit from 'express-rate-limit';

import { User, UserDocument } from '../models/user.model.js';
import { RefreshToken } from '../models/refreshToken.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import { Email } from '../utils/email.js';
import { createSendTokens } from '../utils/createSendTokens.js';
import { RequestHandler, Response } from 'express';

// Helpers
const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const delayedResponse = (res: Response, message: string, statusCode = 200) =>
  setTimeout(
    () => res.status(statusCode).json({ status: 'success', message }),
    Math.floor(Math.random() * 701) + 2000,
  );

interface CodeEmailContext {
  user: UserDocument;
  codeType: 'verificationCode' | 'passwordResetCode';
  emailMethod: 'sendVerifyEmail' | 'sendPasswordReset';
  isNew?: boolean;
}

const generateAndSendCode = async ({
  user,
  codeType,
  emailMethod,
  isNew = false,
}: CodeEmailContext) => {
  const code = user.generateCode(codeType);
  await user.save({ validateBeforeSave: !isNew });

  try {
    await new Email(user, code)[emailMethod]();
  } catch (err) {
    if (isNew) {
      await user.deleteOne();
    } else {
      user[codeType] = undefined;
      user[`${codeType}Expires`] = undefined;
      await user.save({ validateBeforeSave: false });
    }
    throw err;
  }
};

// Controllers
export const signUp = asyncHandler(async (req, res, next) => {
  const { name, email, password, bio = undefined } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return delayedResponse(res, 'Please check your email to continue.', 201);
  }

  const user = new User({ name, email, password, bio });

  try {
    await generateAndSendCode({
      user,
      codeType: 'verificationCode',
      emailMethod: 'sendVerifyEmail',
      isNew: true,
    });
    res.status(201).json({
      status: 'success',
      message: 'Please check your email for the verification code.',
    });
  } catch (err) {
    console.error(err);
    next(
      new AppError(
        'There was an error sending the verification email. Try again later',
        500,
      ),
    );
  }
});

export const verifyEmail = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return next(new AppError('Invalid request. Code or email missed', 400));
  }

  const user = await User.findOneAndUpdate(
    {
      email,
      verificationCode: hashValue(code),
      verificationCodeExpires: { $gt: Date.now() },
    },
    {
      $set: { isVerified: true },
      $unset: { verificationCode: '', verificationCodeExpires: '' },
    },
    { returnDocument: 'after' },
  );

  if (!user) {
    return next(new AppError('Code is invalid or has expired', 400));
  }

  await createSendTokens(user, 200, res);
});

export const resendVerificationCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new AppError('Please provide your email', 400));
  }

  const user = await User.findOne({ email, isVerified: false });
  if (!user) {
    return delayedResponse(
      res,
      'If an unverified account with that email exists, a new verification code has been sent.',
    );
  }

  try {
    await generateAndSendCode({
      user,
      codeType: 'verificationCode',
      emailMethod: 'sendVerifyEmail',
    });
    res.status(200).json({
      status: 'success',
      message:
        'If an unverified account with that email exists, a new verification code has been sent.',
    });
  } catch {
    return next(
      new AppError(
        'There was an error sending the verification email. Try again later',
        500,
      ),
    );
  }
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (!user.isVerified) {
    return next(
      new AppError('Please verify your email before logging in', 401),
    );
  }

  await createSendTokens(user, 200, res);
});

export const logout = asyncHandler(async (req, res, _next) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: hashValue(refreshToken) });
    res.clearCookie('refreshToken');
  }
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

export const forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return delayedResponse(
      res,
      'If an account with that email exists, a password reset code has been sent.',
    );
  }

  try {
    await generateAndSendCode({
      user,
      codeType: 'passwordResetCode',
      emailMethod: 'sendPasswordReset',
    });
    res.status(200).json({
      status: 'success',
      message:
        'If an account with that email exists, a password reset code has been sent.',
    });
  } catch {
    return next(
      new AppError(
        'There was an error sending the email. Try again later',
        500,
      ),
    );
  }
});

export const resetPassword = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return next(new AppError('Invalid request. Code or email missed', 400));
  }

  const user = await User.findOne({
    email,
    passwordResetCode: hashValue(code),
    passwordResetCodeExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Code is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordResetCode = undefined;
  user.passwordResetCodeExpires = undefined;

  await RefreshToken.deleteMany({ user: user._id });
  await user.save();

  await createSendTokens(user, 200, res);
});

export const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!.id).select('+password');

  if (!user || !(await user.correctPassword(currentPassword))) {
    return next(new AppError('Password is incorrect', 401));
  }

  user.password = newPassword;

  await RefreshToken.deleteMany({ user: user._id });
  await user.save();

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
  const options = (max: number, windowMs: number, message: string) => ({
    max,
    windowMs,
    message: `Too many ${message}. Please try again in 15 minutes`,
  });
  const operationOptions = {
    login: options(5, 15 * 60 * 1000, 'login attempts'),
    forgot: options(5, 15 * 60 * 1000, 'password reset requests'),
    reset: options(5, 15 * 60 * 1000, 'password reset requests'),
    verify: options(5, 15 * 60 * 1000, 'verification attempts'),
    resend: options(3, 15 * 60 * 1000, 'resend verification requests'),
    refresh: options(2, 15 * 60 * 1000, 'refresh token requests'),
    global: options(
      100,
      60 * 60 * 1000,
      'Too many requests from this IP, please try again in an hour',
    ),
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

export const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return next(new AppError('Refresh token is missed', 401));
  }

  const existingToken = await RefreshToken.findOneAndDelete({
    token: hashValue(refreshToken),
  });
  if (!existingToken) {
    return next(new AppError('Invalid or expired token', 401));
  }

  const user = await User.findById(existingToken.user);
  if (!user) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist',
        401,
      ),
    );
  }

  await createSendTokens(user, 200, res);
});
