import { Router } from 'express';

import * as categoryController from './category.controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  categoryParamSchema,
  categoryQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from './category.schema.js';

const router = Router();

router
  .route('/')
  .get(validate({ query: categoryQuerySchema }), categoryController.getAllCategories)
  .post(
    protect,
    restrictTo('admin'),
    validate({ body: createCategorySchema }),
    categoryController.createCategory,
  );

router
  .route('/:id')
  .get(validate({ params: categoryParamSchema }), categoryController.getCategory)
  .patch(
    protect,
    restrictTo('admin'),
    validate({ params: categoryParamSchema, body: updateCategorySchema }),
    categoryController.updateCategory,
  )
  .delete(
    protect,
    restrictTo('admin'),
    validate({ params: categoryParamSchema }),
    categoryController.deleteCategory,
  );

export { router as categoryRouter };
