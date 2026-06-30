import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { User } from '../../models/user.model.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreateServiceRequestInput,
  ServiceRequestQuery,
  UpdateServiceRequestInput,
} from './serviceRequest.schema.js';
import { generateTagsFromAI } from '../../services/ai/tagger.service.js';

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

const ensureSufficientWalletBalance = async (
  userId: string,
  creditsOffered: number,
) => {
  const user = await User.findById(userId).select('walletBalance');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.walletBalance < creditsOffered) {
    throw new AppError(
      'Insufficient wallet balance for the offered credits',
      400,
    );
  }
};

export const createServiceRequest = async (
  userId: string,
  data: CreateServiceRequestInput,
  files?: Express.Multer.File[],
) => {
  await ensureSufficientWalletBalance(userId, data.creditsOffered);
  await ensureCategoryExists(data.category);
  const referenceImages = files?.length
    ? await Promise.all(
        files.map(async (file) => {
          const uploadResult = await uploadImage(file, 'service-requests');

          return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
          };
        }),
      )
    : data.referenceImages;

  const listing = await ServiceRequest.create({
    ...data,
    referenceImages,
    user: userId,
  });

  generateTagsFromAI(listing.title, listing.description ?? '')
    .then(async (tags) => {
      if (tags.length > 0) {
        await ServiceRequest.findByIdAndUpdate(listing._id, { $set: { tags } });
      }
    })
    .catch((err) =>
      console.error(`[TagSuggester] Failed for listing ${listing._id}:`, err),
    );

  return listing;
};

export const getServiceRequest = async (
  id: string,
  query: dbFactory.FieldSelectionOptions = {},
) => {
  const mongooseQuery = ServiceRequest.findById(id)
    .populate('user', 'name avatar')
    .populate('category', 'name slug');

  return dbFactory.findDocumentOrThrow(mongooseQuery, query);
};

export const getAllServiceRequests = async (query: ServiceRequestQuery) => {
  const mongooseQuery = ServiceRequest.find()
    .populate('user', 'name avatar')
    .populate('category', 'name slug');

  return await dbFactory.findMany(mongooseQuery, query, [
    'title',
    'description',
    'tags',
  ]);
};

export const updateServiceRequest = async (
  id: string,
  user: CurrentUser,
  data: UpdateServiceRequestInput,
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

  let updatedServiceRequest;
  // Fetch early only when update logic needs the current owner/images; otherwise updateDocumentOrThrow handles existence.
  const serviceRequest =
    data.creditsOffered !== undefined || files?.length
      ? await ServiceRequest.findOne(filter)
      : null;

  if ((data.creditsOffered !== undefined || files?.length) && !serviceRequest) {
    throw new AppError('No servicerequest found with that ID', 404);
  }

  if (data.creditsOffered !== undefined) {
    await ensureSufficientWalletBalance(
      serviceRequest!.user.toString(),
      data.creditsOffered,
    );
  }

  if (files?.length) {
    updateData.referenceImages = await Promise.all(
      files.map(async (file) => {
        const uploadResult = await uploadImage(file, 'service-requests');

        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
      }),
    );

    updatedServiceRequest = await dbFactory.updateDocumentOrThrow(
      ServiceRequest,
      filter,
      updateData,
    );

    Promise.allSettled(
      serviceRequest!.referenceImages
        .map((image) => image.publicId)
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteImage(publicId)),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(`Failed to delete old reference image:`, result.reason);
        }
      });
    });
  } else {
    updatedServiceRequest = await dbFactory.updateDocumentOrThrow(
      ServiceRequest,
      filter,
      updateData,
    );
  }

  if (data.title || data.description) {
    generateTagsFromAI(
      updatedServiceRequest.title,
      updatedServiceRequest.description || '',
    )
      .then(async (aiTags) => {
        if (aiTags.length > 0) {
          await ServiceRequest.findByIdAndUpdate(updatedServiceRequest._id, {
            $set: { tags: aiTags },
          });
        }
      })
      .catch((err) =>
        console.error(`[AI Tags ServiceRequest Update Error]:`, err),
      );
  }

  return updatedServiceRequest;
};

export const deleteServiceRequest = async (id: string, user: CurrentUser) => {
  const filter = dbFactory.buildOwnerScopedFilter(id, {
    ownerField: 'user',
    user,
  }) as QueryFilter<unknown>;

  const serviceRequest = await dbFactory.deleteDocumentOrThrow(
    ServiceRequest,
    filter,
  );

  await Promise.allSettled(
    serviceRequest.referenceImages
      .map((image) => image.publicId)
      .filter((publicId): publicId is string => Boolean(publicId))
      .map((publicId) => deleteImage(publicId)),
  ).then((results) => {
    results.forEach((result, _i) => {
      if (result.status === 'rejected') {
        console.error(`Failed to delete old reference image:`, result.reason);
      }
    });
  });

  return;
};
