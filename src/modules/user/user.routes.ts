import { RequestHandler, Router } from 'express';

import * as userController from './user.controller.js';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { serviceRequestRouter } from '../serviceRequest/serviceRequest.routes.js';
import { skillListingRouter } from '../skillListing/skillListing.routes.js';
import {
  createUserSchema,
  updateUserAdminSchema,
  updateUserSelfSchema,
  userParamsSchema,
  userQuerySchema,
} from './user.schema.js';
import { upload } from '../../middleware/upload.js';
const router = Router();

const setMe: RequestHandler = (req, res, next) => {
  req.params.userId = req.user!.id;
  next();
};

router.use(protect);

router.use('/me/skill-listings', setMe, skillListingRouter);
router.use('/:userId/skill-listings', skillListingRouter);
router.use('/me/service-requests', setMe, serviceRequestRouter);
router.use('/:userId/service-requests', serviceRequestRouter);

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
