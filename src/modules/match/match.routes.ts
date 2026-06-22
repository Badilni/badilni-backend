import { Router } from 'express';

import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as matchController from './match.controller.js';
import { matchParamsSchema, matchQuerySchema } from './match.schema.js';

const router = Router();

router.use(protect);

router.get(
  '/',
  validate({ query: matchQuerySchema }),
  matchController.getMyMatches,
);

router.post(
  '/run',
  restrictTo('admin'),
  matchController.triggerMatchmaker,
);

router.patch(
  '/:id/accept',
  validate({ params: matchParamsSchema }),
  matchController.acceptMatch,
);

router.patch(
  '/:id/dismiss',
  validate({ params: matchParamsSchema }),
  matchController.dismissMatch,
);

export { router as matchRouter };
