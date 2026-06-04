import { asyncHandler } from '../../utils/asyncHandler.js';
import * as userService from './user.service.js';
import { UserParams } from './user.schema.js';

// Admin only
export const createUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ status: 'success', data: { user } });
});

export const getUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.getUser((req.params as UserParams).id);
  res.status(200).json({ status: 'success', data: { user } });
});

export const getMe = asyncHandler(async (req, res, _next) => {
  const user = await userService.getUser(req.user!.id);
  res.status(200).json({ status: 'success', data: { user } });
});

export const getAllUsers = asyncHandler(async (req, res, _next) => {
  const users = await userService.getAllUsers(req.query);
  res.status(200).json({ status: 'success', data: { users } });
});

export const updateMe = asyncHandler(async (req, res, _next) => {
  const user = await userService.updateMe(req.user!.id, req.body);
  res.status(200).json({ status: 'success', data: { user } });
});

export const deActivateMe = asyncHandler(async (req, res, _next) => {
  const user = await userService.deActivateMe(req.user!.id);
  res.status(200).json({ status: 'success', data: { user } });
});

// Admin only
export const updateUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.updateUser(
    (req.params as UserParams).id,
    req.body,
  );
  res.status(200).json({ status: 'success', data: { user } });
});

// Admin only
export const deleteUser = asyncHandler(async (req, res, _next) => {
  await userService.deleteUser((req.params as UserParams).id);
  res.sendStatus(204);
});
