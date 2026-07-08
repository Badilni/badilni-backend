import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreateSkillListingInput,
  SkillListingQuery,
  UpdateSkillListingInput,
} from './skillListing.schema.js';
import { generateTagsFromAI } from '../../services/ai/tagger.service.js';

interface CurrentUser {
  id: string;
  role?: string;
}

const ensureCategoryExists = async (id: string) => {
  const category = await Category.findById(id);

  if (!category) {
    throw new AppError('No category found with this id', 404);
  }

  return category.name;
};

export const createSkillListing = async (
  userId: string,
  data: CreateSkillListingInput,
  files?: Express.Multer.File[],
) => {
  const categoryName = await ensureCategoryExists(data.category);
  const sampleWork = files?.length
    ? await Promise.all(
        files.map(async (file) => {
          const uploadResult = await uploadImage(file, 'skill-listings');

          return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
          };
        }),
      )
    : data.sampleWork;

  const listing = await SkillListing.create({
    ...data,
    sampleWork,
    user: userId,
  });

  generateTagsFromAI(categoryName, listing.title, listing.description ?? '')
    .then(async (tags) => {
      if (tags.length > 0) {
        await SkillListing.findByIdAndUpdate(listing._id, { $set: { tags } });
      }
    })
    .catch((err) =>
      console.error(`[TagSuggester] Failed for listing ${listing._id}:`, err),
    );

  return listing;
};

export const getSkillListing = async (
  id: string,
  query: dbFactory.FieldSelectionOptions = {},
) => {
  const mongooseQuery = SkillListing.findById(id)
    .populate('user', 'name avatar')
    .populate('category', 'name slug');

  return dbFactory.findDocumentOrThrow(mongooseQuery, query);
};

export const getAllSkillListings = async (query: SkillListingQuery) => {
  const mongooseQuery = SkillListing.find()
    .populate('user', 'name avatar')
    .populate('category', 'name slug');

  return await dbFactory.findMany(mongooseQuery, query, [
    'title',
    'description',
    'tags',
  ]);
};

export const updateSkillListing = async (
  id: string,
  user: CurrentUser,
  data: UpdateSkillListingInput,
  files?: Express.Multer.File[],
) => {
  let categoryName: string | null = null;
  if (data.category) {
    categoryName = await ensureCategoryExists(data.category);
  }

  const filter = dbFactory.buildOwnerScopedFilter(id, {
    ownerField: 'user',
    user,
  }) as QueryFilter<unknown>;
  const updateData = { ...data };

  let updatedSkillListing;

  if (files?.length) {
    const skillListing = await SkillListing.findOne(filter);

    if (!skillListing) {
      throw new AppError('No skilllisting found with that ID', 404);
    }

    updateData.sampleWork = await Promise.all(
      files.map(async (file) => {
        const uploadResult = await uploadImage(file, 'skill-listings');

        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
      }),
    );

    updatedSkillListing = await dbFactory.updateDocumentOrThrow(
      SkillListing,
      filter,
      updateData,
    );

    Promise.allSettled(
      skillListing.sampleWork
        .map((sample) => sample.publicId)
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteImage(publicId)),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to delete old sample work image:`,
            result.reason,
          );
        }
      });
    });
  } else {
    updatedSkillListing = await dbFactory.updateDocumentOrThrow(
      SkillListing,
      filter,
      updateData,
    );
  }

  if (data.title || data.description || data.category) {
    const category =
      categoryName ||
      (
        await updatedSkillListing.populate<{ category: { name: string } }>(
          'category',
          'name',
        )
      ).category.name;

    generateTagsFromAI(
      category,
      updatedSkillListing.title,
      updatedSkillListing.description ?? '',
    )
      .then(async (tags) => {
        if (tags.length > 0) {
          await SkillListing.findByIdAndUpdate(updatedSkillListing._id, {
            $set: { tags },
          });
        }
      })
      .catch((err) =>
        console.error(
          `[TagSuggester] Failed for listing ${updatedSkillListing._id}:`,
          err,
        ),
      );
  }

  return updatedSkillListing;
};
export const deleteSkillListing = async (id: string, user: CurrentUser) => {
  const filter = dbFactory.buildOwnerScopedFilter(id, {
    ownerField: 'user',
    user,
  }) as QueryFilter<unknown>;

  const skillListing = await dbFactory.deleteDocumentOrThrow(
    SkillListing,
    filter,
  );

  await Promise.allSettled(
    skillListing.sampleWork
      .map((sample) => sample.publicId)
      .filter((publicId): publicId is string => Boolean(publicId))
      .map((publicId) => deleteImage(publicId)),
  ).then((results) => {
    results.forEach((result, _i) => {
      if (result.status === 'rejected') {
        console.error(`Failed to delete old sample work image:`, result.reason);
      }
    });
  });

  return;
};
