import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import { AppError } from '../../utils/appError.js';
import { APIFeatures } from '../../utils/apiFeatures.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreateSkillListingInput,
  SkillListingQuery,
  UpdateSkillListingInput,
} from './skillListing.schema.js';

interface CurrentUser {
  id: string;
  role?: string;
}

const ensureCategoryExists = async (category: string) => {
  const categoryExists = await Category.exists({ _id: category });

  if (!categoryExists) {
    throw new AppError('No category found with this id', 404);
  }
};

export const createSkillListing = async (
  userId: string,
  data: CreateSkillListingInput,
  files?: Express.Multer.File[],
) => {
  await ensureCategoryExists(data.category);
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

  return SkillListing.create({
    ...data,
    sampleWork,
    user: userId,
  });
};

export const getSkillListing = async (id: string) => {
  return SkillListing.findById(id)
    .populate('user', 'name avatar')
    .populate('category', 'name slug')
    .orFail(new AppError('No skilllisting found with this id', 404));
};

export const getAllSkillListings = async (query: SkillListingQuery) => {
  console.log(query);

  const {
    docs,
    paginationResult: { totalCount, totalPages, page, limit },
  } = await new APIFeatures(
    SkillListing.find()
      .populate('user', 'name avatar')
      .populate('category', 'name slug'),
    query,
    ['title', 'description', 'tags'],
  )
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate()
    .exec();

  return {
    docs,
    pagination: { page, limit, totalCount, totalPages },
  };
};

export const updateSkillListing = async (
  id: string,
  user: CurrentUser,
  data: UpdateSkillListingInput,
  files?: Express.Multer.File[],
) => {
  if (data.category) {
    await ensureCategoryExists(data.category);
  }

  const filter = dbFactory.buildOwnerScopedFilter(id, {
    ownerField: 'user',
    user,
  }) as QueryFilter<unknown>;
  const updateData = { ...data };

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

    const updatedSkillListing = await dbFactory.updateDocumentOrThrow(
      SkillListing,
      filter,
      updateData,
    );

    await Promise.allSettled(
      skillListing.sampleWork
        .map((sample) => sample.publicId)
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteImage(publicId)),
    ).then((results) => {
      results.forEach((result, _i) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to delete old sample work image:`,
            result.reason,
          );
        }
      });
    });

    return updatedSkillListing;
  }

  return dbFactory.updateDocumentOrThrow(SkillListing, filter, updateData);
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
