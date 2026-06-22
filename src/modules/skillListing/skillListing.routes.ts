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
  smartSearchSchema,
  suggestTagsSchema,
  updateSkillListingSchema,
  userSkillListingsParamsSchema,
} from './skillListing.schema.js';
import { normalizeUserFilter } from '../../middleware/normalizeFilter.js';

const router = Router({ mergeParams: true });

router.post(
  '/suggest-tags',
  protect,
  validate({ body: suggestTagsSchema }),
  skillListingController.suggestTags,
);

router.post(
  '/smart-search',
  validate({ body: smartSearchSchema }),
  skillListingController.smartSearch,
);

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