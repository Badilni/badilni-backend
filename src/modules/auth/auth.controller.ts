import { asyncHandler } from '../../utils/asyncHandler.js';
import { createSendTokens } from '../../utils/createSendTokens.js';
import { Response } from 'express';

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

export const refreshToken = asyncHandler(async (req, res, _next) => {
  const user = await authService.refreshTokens(req.cookies.refreshToken);
  await createSendTokens(user, 200, res);
});
