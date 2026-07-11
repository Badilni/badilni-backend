import { asyncHandler } from '../../utils/asyncHandler.js';
import * as userService from './user.service.js';
import { UserParams } from './user.schema.js';

// Admin only
export const createUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.createUser(req.body, req.file);
  res.status(201).json({ status: 'success', data: { user } });
});

export const getUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.getUser(req.params.id as string, req.query);
  res.status(200).json({ status: 'success', data: { user } });
});

export const getMe = asyncHandler(async (req, res, _next) => {
  const user = await userService.getUser(req.user!.id, req.query);
  res.status(200).json({ status: 'success', data: { user } });
});

export const getAllUsers = asyncHandler(async (req, res, _next) => {
  const { docs: users, pagination } = await userService.getAllUsers(req.query);

  res.status(200).json({
    status: 'success',
    pagination,
    data: { users },
  });
});

export const getReviewSummary = asyncHandler(async (req, res, _next) => {
  const summary = await userService.getReviewSummary(
    req.params.userId as string,
  );

  res.status(200).json({ status: 'success', data: { summary } });
});

export const updateMe = asyncHandler(async (req, res, _next) => {
  const user = await userService.updateMe(req.user!.id, req.body, req.file);
  res.status(200).json({ status: 'success', data: { user } });
});

export const removeAvatar = asyncHandler(async (req, res, _next) => {
  const user = await userService.removeAvatar(req.user!.id);
  res.status(200).json({ status: 'success', data: { user } });
});

export const deactivateMe = asyncHandler(async (req, res, _next) => {
  await userService.deactivateMe(req.user!.id);

  res.clearCookie('refreshToken');
  res.clearCookie('accessToken');

  res.sendStatus(204);
});

// Admin only
export const updateUser = asyncHandler(async (req, res, _next) => {
  const user = await userService.updateUser(
    (req.params as UserParams).id,
    req.body,
    req.file,
    req.user!.id,
  );
  res.status(200).json({ status: 'success', data: { user } });
});

// Admin only
export const deleteUser = asyncHandler(async (req, res, _next) => {
  await userService.deleteUser((req.params as UserParams).id, req.user!.id);
  res.sendStatus(204);
});