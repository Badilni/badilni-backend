import { Router } from 'express';

import * as userController from './user.controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  updateUserAdminSchema,
  updateUserSelfSchema,
  userParamsSchema,
  userQuerySchema,
} from './user.schema.js';
const router = Router();

router.use(protect);

router
  .route('/me')
  .get(userController.getMe)
  .patch(validate({ body: updateUserSelfSchema }), userController.updateMe)
  .delete(userController.deactivateMe);

router.get(
  '/',
  validate({ query: userQuerySchema }),
  userController.getAllUsers,
);

router.use(restrictTo('admin'));
router
  .route('/')
  .patch(
    validate({ params: userParamsSchema, body: updateUserAdminSchema }),
    userController.updateUser,
  )
  .delete(validate({ params: userParamsSchema }), userController.deleteUser);

export { router as userRouter };
