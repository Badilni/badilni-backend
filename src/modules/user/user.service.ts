import { RefreshToken } from '../../models/refreshToken.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import * as adminActionService from '../adminAction/adminAction.service.js';
import {
  UpdateUserAdminInput,
  CreateUserInput,
  UpdateUserSelfInput,
} from './user.schema.js';

export const createUser = async (
  data: CreateUserInput,
  file?: Express.Multer.File,
) => {
  let avatar = data.avatar;

  if (file) {
    const uploadResult = await uploadImage(file, 'users');
    avatar = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
  }

  return dbFactory.createDocument(User, { ...data, avatar });
};

export const getUser = async (
  id: string,
  query: dbFactory.FieldSelectionOptions = {},
) => {
  return dbFactory.findByIdOrThrow(User, id, query);
};

export const getAllUsers = async (queryString: Record<string, unknown>) => {
  return dbFactory.findMany(User.find(), queryString, ['name']);
};

export const updateMe = async (
  userId: string,
  data: UpdateUserSelfInput,
  file?: Express.Multer.File,
) => {
  const user = await dbFactory.findByIdOrThrow(User, userId);
  let avatar = user.avatar;

  if (file) {
    const uploadResult = await uploadImage(file, 'users');
    avatar = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }
  }

  return dbFactory.updateDocumentOrThrow(
    User,
    { _id: userId },
    { ...data, avatar },
  );
};

export const removeAvatar = async (userId: string) => {
  const DEFAULT_AVATAR_URL =
    'https://res.cloudinary.com/dcujx986a/image/upload/v1780758978/default_avatar_yvgiqh.jpg';

  const user = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: userId },
    {
      $set: { 'avatar.url': DEFAULT_AVATAR_URL },
      $unset: { 'avatar.publicId': '' },
    },
    {
      returnDocument: 'before',
      lean: true,
    },
  );

  if (user.avatar?.publicId) {
    await deleteImage(user.avatar.publicId);
  }

  user.avatar = {
    url: DEFAULT_AVATAR_URL,
  };

  return user;
};

export const deactivateMe = async (userId: string) => {
  return Promise.all([
    dbFactory.updateDocumentOrThrow(User, { _id: userId }, { active: false }),
    RefreshToken.deleteMany({ user: userId }),
  ]);
};

// Admin only

export const updateUser = async (
  userId: string,
  data: UpdateUserAdminInput,
  file: Express.Multer.File | undefined,
  adminId: string,
) => {
  // `active` is select:false — fetch it explicitly so we can detect a
  // suspend/unsuspend transition below without a second round-trip.
  const user = await User.findById(userId).select('+active');
  if (!user) {
    throw new AppError('No user found with this id', 404);
  }

  let avatar = user.avatar;

  if (file) {
    const uploadResult = await uploadImage(file, 'users');
    avatar = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }
  }

  const updated = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: userId },
    { ...data, avatar },
  );

  if (data.active !== undefined && data.active !== user.active) {
    adminActionService.logAction({
      adminId,
      action: data.active ? 'unsuspend' : 'suspend',
      targetId: userId,
      targetModel: 'User',
    });
  }

  return updated;
};

export const deleteUser = async (userId: string, adminId: string) => {
  const deleted = await dbFactory.deleteDocumentOrThrow(User, { _id: userId });

  adminActionService.logAction({
    adminId,
    action: 'delete',
    targetId: userId,
    targetModel: 'User',
    details: { name: deleted.name, email: deleted.email },
  });

  return deleted;
};
