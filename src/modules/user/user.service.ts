import { User } from '../../models/user.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  AdminUpdateUserInput,
  CreateUserInput,
  UserSelfUpdateInput,
} from './user.schema.js';

export const createUser = async (data: CreateUserInput) => {
  const user = await User.create(data);
  return user;
};

export const getUser = async (id: string) => {
  const user = await dbFactory.findByIdOrThrow(User, id);
  return user;
};

export const getAllUsers = async (queryString: Record<string, unknown>) => {
  const users = await dbFactory.findMany(User, queryString, ['name']);
  return users;
};

export const updateMe = async (userId: string, data: UserSelfUpdateInput) => {
  const user = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: userId },
    data,
  );
  return user;
};

export const deActivateMe = async (userId: string) => {
  const user = await dbFactory.updateDocumentOrThrow(
    User,
    { _id: userId },
    { active: false },
  );
  return user;
};

export const updateUser = async (
  userId: string,
  data: AdminUpdateUserInput,
) => {
  const filter = dbFactory.buildOwnerScopedFilter(userId);
  const user = await dbFactory.updateDocumentOrThrow(User, filter, data);
  return user;
};

export const deleteUser = async (userId: string) => {
  const filter = dbFactory.buildOwnerScopedFilter(userId);
  await dbFactory.deleteDocumentOrThrow(User, filter);
};
