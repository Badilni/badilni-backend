import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { fieldSelectionQuerySchema } from '../../utils/common.schema.js';
import * as skillListingController from './skillListing.controller.js';
import {
  createSkillListingSchema,
  skillListingParamsSchema,
  skillListingQuerySchema,
  updateSkillListingSchema,
  userSkillListingsParamsSchema,
} from './skillListing.schema.js';
import {
  normalizeListingFilter,
  normalizeUserFilter,
} from '../../middleware/normalizeFilter.js';
import { reviewRouter } from '../review/review.routes.js';

const router = Router({ mergeParams: true });

router
  .route('/')
  .get(
    normalizeUserFilter,
    validate({
      query: skillListingQuerySchema,
      params: userSkillListingsParamsSchema,
    }),
    skillListingController.getAllSkillListings,
  )
  .post(
    protect,
    upload.array('sampleWork', 5),
    validate({ body: createSkillListingSchema }),
    skillListingController.createSkillListing,
  );

router.use('/:listingId/reviews', normalizeListingFilter, reviewRouter);

router
  .route('/:id')
  .get(
    validate({
      params: skillListingParamsSchema,
      query: fieldSelectionQuerySchema,
    }),
    skillListingController.getSkillListing,
  )
  .patch(
    protect,
    upload.array('sampleWork', 5),
    validate({
      params: skillListingParamsSchema,
      body: updateSkillListingSchema,
    }),
    skillListingController.updateSkillListing,
  )
  .delete(
    protect,
    validate({ params: skillListingParamsSchema }),
    skillListingController.deleteSkillListing,
  );

export { router as skillListingRouter };
