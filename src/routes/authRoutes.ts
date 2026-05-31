import { Router } from 'express';

import * as authController from '../modules/auth/auth.controller.js';

const router = Router();

router.post('/signup', authController.signUp);
router.post('/login', authController.rateLimit('login'), authController.login);
router.post('/logout', authController.logout);
router.post(
  '/forgot-password',
  authController.rateLimit('forgot'),
  authController.forgotPassword,
);
router.patch(
  '/reset-password',
  authController.rateLimit('reset'),
  authController.resetPassword,
);
router.post(
  '/verify-email',
  authController.rateLimit('verify'),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  authController.rateLimit('resend'),
  authController.resendVerificationCode,
);
router.post(
  '/refresh',
  authController.rateLimit('refresh'),
  authController.refreshToken,
);

router.patch(
  '/me/password',
  authController.protect,
  authController.updatePassword,
);

export { router as authRouter };
