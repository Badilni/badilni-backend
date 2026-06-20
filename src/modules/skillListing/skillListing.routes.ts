import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as skillListingController from './skillListing.controller.js';
import {
  createSkillListingSchema,
  skillListingParamsSchema,
  skillListingQuerySchema,
  updateSkillListingSchema,
} from './skillListing.schema.js';

const router = Router();

router
  .route('/')
  .get(
    validate({ query: skillListingQuerySchema }),
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
    validate({ params: skillListingParamsSchema }),
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
