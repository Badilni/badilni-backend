import { asyncHandler } from '../../utils/asyncHandler.js';
import { createSendTokens, sendEmailFlowResponse } from './auth.helpers.js';

import * as authService from './auth.service.js';

export const signUp = asyncHandler(async (req, res, _next) => {
  const { emailSent } = await authService.signup(req.body);

  sendEmailFlowResponse(res, {
    emailSent,
    message:
      'If the email provided is valid, a verification code has been sent.',
    statusCode: 201,
  });
});

export const verifyEmail = asyncHandler(async (req, res, _next) => {
  const user = await authService.verifyEmail(req.body);
  await createSendTokens(user, 200, res);
});

export const resendVerificationCode = asyncHandler(async (req, res, _next) => {
  const { emailSent } = await authService.resendVerificationCode(req.body);

  sendEmailFlowResponse(res, {
    emailSent,
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

  sendEmailFlowResponse(res, {
    emailSent,
    message:
      'If an account with that email exists, a password reset code has been sent.',
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
