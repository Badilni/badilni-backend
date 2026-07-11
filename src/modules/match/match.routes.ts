import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as matchController from './match.controller.js';
import { matchParamsSchema, matchQuerySchema } from './match.schema.js';

const router = Router();

router.use(protect);

router
  .route('/')
  .get(validate({ query: matchQuerySchema }), matchController.getMyMatches);

router
  .route('/:id')
  .get(validate({ params: matchParamsSchema }), matchController.getMatch);

export { router as matchRouter };
