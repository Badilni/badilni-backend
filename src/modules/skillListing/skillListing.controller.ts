import { asyncHandler } from '../../utils/asyncHandler.js';
import * as skillListingService from './skillListing.service.js';
import {
  SkillListingParams,
  SkillListingQuery,
} from './skillListing.schema.js';

const getUploadedFiles = (files: Express.Multer.File[] | undefined) => files;

export const createSkillListing = asyncHandler(async (req, res, _next) => {
  const skillListing = await skillListingService.createSkillListing(
    req.user!.id,
    req.body,
    getUploadedFiles(req.files as Express.Multer.File[] | undefined),
  );

  res.status(201).json({ status: 'success', data: { skillListing } });
});

export const getSkillListing = asyncHandler(async (req, res, _next) => {
  const skillListing = await skillListingService.getSkillListing(
    (req.params as SkillListingParams).id,
    req.query,
  );

  res.status(200).json({ status: 'success', data: { skillListing } });
});

export const getAllSkillListings = asyncHandler(async (req, res, _next) => {
  const { docs: skillListings, pagination } =
    await skillListingService.getAllSkillListings(
      req.query as unknown as SkillListingQuery,
    );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { skillListings },
  });
});

export const updateSkillListing = asyncHandler(async (req, res, _next) => {
  const skillListing = await skillListingService.updateSkillListing(
    (req.params as SkillListingParams).id,
    req.user!,
    req.body,
    getUploadedFiles(req.files as Express.Multer.File[] | undefined),
  );

  res.status(200).json({ status: 'success', data: { skillListing } });
});

export const deleteSkillListing = asyncHandler(async (req, res, _next) => {
  await skillListingService.deleteSkillListing(
    (req.params as SkillListingParams).id,
    req.user!,
  );

  res.sendStatus(204);
});
