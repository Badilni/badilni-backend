import { Router } from 'express';

import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  emailCodeSchema,
  emailSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updatePasswordSchema,
} from './auth.schema.js';

const router = Router();

router.post('/signup', validate({ body: signupSchema }), authController.signUp);
router.post(
  '/login',
  validate({ body: loginSchema }),
  authController.rateLimit('login'),
  authController.login,
);
router.post('/logout', authController.logout);
router.post(
  '/forgot-password',
  authController.rateLimit('forgot'),
  validate({ body: emailSchema }),
  authController.forgotPassword,
);
router.patch(
  '/reset-password',
  authController.rateLimit('reset'),
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);
router.post(
  '/verify-email',
  authController.rateLimit('verify'),
  validate({ body: emailCodeSchema }),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  authController.rateLimit('resend'),
  validate({ body: emailSchema }),
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
  validate({ body: updatePasswordSchema }),
  authController.updatePassword,
);

export { router as authRouter };
