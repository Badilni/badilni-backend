import { Router } from 'express';

import { protect } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { fieldSelectionQuerySchema } from '../../utils/common.schema.js';
import * as serviceRequestController from './serviceRequest.controller.js';
import {
  createServiceRequestSchema,
  serviceRequestParamsSchema,
  serviceRequestQuerySchema,
  updateServiceRequestSchema,
  userServiceRequestsParamsSchema,
} from './serviceRequest.schema.js';
import { normalizeUserFilter } from '../../middleware/normalizeFilter.js';

const router = Router({ mergeParams: true });

router
  .route('/')
  .get(
    normalizeUserFilter,
    validate({
      query: serviceRequestQuerySchema,
      params: userServiceRequestsParamsSchema,
    }),
    serviceRequestController.getAllServiceRequests,
  )
  .post(
    protect,
    upload.array('referenceImages', 5),
    validate({ body: createServiceRequestSchema }),
    serviceRequestController.createServiceRequest,
  );

router
  .route('/:id')
  .get(
    validate({
      params: serviceRequestParamsSchema,
      query: fieldSelectionQuerySchema,
    }),
    serviceRequestController.getServiceRequest,
  )
  .patch(
    protect,
    upload.array('referenceImages', 5),
    validate({
      params: serviceRequestParamsSchema,
      body: updateServiceRequestSchema,
    }),
    serviceRequestController.updateServiceRequest,
  )
  .delete(
    protect,
    validate({ params: serviceRequestParamsSchema }),
    serviceRequestController.deleteServiceRequest,
  );

export { router as serviceRequestRouter };
