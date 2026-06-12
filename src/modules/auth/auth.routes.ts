import { Router } from 'express';

import * as authController from './auth.controller.js';
import { protect } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import {
  emailCodeSchema,
  emailSchema,
  loginSchema,
  requestEmailChangeSchema,
  resetPasswordSchema,
  signupSchema,
  updatePasswordSchema,
  verifyEmailChangeSchema,
} from './auth.schema.js';

const router = Router();

router.post(
  '/signup',
  validate({ body: signupSchema }),
  rateLimit('signup'),
  authController.signUp,
);
router.post(
  '/login',
  validate({ body: loginSchema }),
  rateLimit('login'),
  authController.login,
);
router.post('/logout', authController.logout);
router.post(
  '/forgot-password',
  rateLimit('forgot'),
  validate({ body: emailSchema }),
  authController.forgotPassword,
);
router.patch(
  '/reset-password',
  rateLimit('reset'),
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);
router.post(
  '/verify-email',
  rateLimit('verify'),
  validate({ body: emailCodeSchema }),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  rateLimit('resend'),
  validate({ body: emailSchema }),
  authController.resendVerificationCode,
);
router.post('/refresh', rateLimit('refresh'), authController.refreshToken);

router.patch(
  '/me/password',
  protect,
  rateLimit('updatePassword'),
  validate({ body: updatePasswordSchema }),
  authController.updatePassword,
);

router.patch(
  '/me/email',
  protect,
  rateLimit('requestEmailChange'),
  validate({ body: requestEmailChangeSchema }),
  authController.requestEmailChange,
);

router.post(
  '/me/email/verify',
  protect,
  rateLimit('verifyEmailChange'),
  validate({ body: verifyEmailChangeSchema }),
  authController.verifyEmailChange,
);

export { router as authRouter };
