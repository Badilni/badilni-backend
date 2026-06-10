import { Router } from 'express';

import * as userController from './user.controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserSchema,
  updateUserAdminSchema,
  updateUserSelfSchema,
  userParamsSchema,
  userQuerySchema,
} from './user.schema.js';
import { upload } from '../../middleware/upload.js';
const router = Router();

router.use(protect);

router
  .route('/me')
  .get(userController.getMe)
  .patch(
    upload.single('avatar'),
    validate({ body: updateUserSelfSchema }),
    userController.updateMe,
  )
  .delete(userController.deactivateMe);

router.delete('/me/avatar', userController.removeAvatar);

router
  .route('/')
  .get(validate({ query: userQuerySchema }), userController.getAllUsers)
  .post(
    upload.single('avatar'),
    validate({ body: createUserSchema }),
    userController.createUser,
  );

router.use(restrictTo('admin'));
router
  .route('/:id')
  .get(validate({ params: userParamsSchema }), userController.getUser)
  .patch(
    upload.single('avatar'),
    validate({ params: userParamsSchema, body: updateUserAdminSchema }),
    userController.updateUser,
  )
  .delete(validate({ params: userParamsSchema }), userController.deleteUser);

export { router as userRouter };
