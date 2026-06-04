import { RefreshToken } from '../../models/refreshToken.model.js';
import { User } from '../../models/user.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  UpdateUserAdminInput,
  CreateUserInput,
  UpdateUserSelfInput,
} from './user.schema.js';

export const createUser = async (data: CreateUserInput) => {
  return dbFactory.createDocument(User, data);
};

export const getUser = async (id: string) => {
  return dbFactory.findByIdOrThrow(User, id);
};

export const getAllUsers = async (queryString: Record<string, unknown>) => {
  return dbFactory.findMany(User, queryString, ['name']);
};

export const updateMe = async (userId: string, data: UpdateUserSelfInput) => {
  return dbFactory.updateDocumentOrThrow(User, { _id: userId }, data);
};

export const deactivateMe = async (userId: string) => {
  return Promise.all([
    dbFactory.updateDocumentOrThrow(User, { _id: userId }, { active: false }),
    RefreshToken.deleteMany({ user: userId }),
  ]);
};

export const updateUser = async (
  userId: string,
  data: UpdateUserAdminInput,
) => {
  return dbFactory.updateDocumentOrThrow(User, { _id: userId }, data);
};

export const deleteUser = async (userId: string) => {
  return dbFactory.deleteDocumentOrThrow(User, { _id: userId });
};
