import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreateServiceRequestInput,
  ServiceRequestQuery,
  UpdateServiceRequestInput,
} from './serviceRequest.schema.js';

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

export const createServiceRequest = async (
  userId: string,
  data: CreateServiceRequestInput,
  files?: Express.Multer.File[],
) => {
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

  return ServiceRequest.create({
    ...data,
    referenceImages,
    user: userId,
  });
};

export const getServiceRequest = async (id: string) => {
  return ServiceRequest.findById(id)
    .populate('user', 'name avatar')
    .populate('category', 'name slug')
    .orFail(new AppError('No servicerequest found with this id', 404));
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

  if (files?.length) {
    const serviceRequest = await ServiceRequest.findOne(filter);

    if (!serviceRequest) {
      throw new AppError('No servicerequest found with that ID', 404);
    }

    updateData.referenceImages = await Promise.all(
      files.map(async (file) => {
        const uploadResult = await uploadImage(file, 'service-requests');

        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
      }),
    );

    const updatedServiceRequest = await dbFactory.updateDocumentOrThrow(
      ServiceRequest,
      filter,
      updateData,
    );

    await Promise.allSettled(
      serviceRequest.referenceImages
        .map((image) => image.publicId)
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteImage(publicId)),
    ).then((results) => {
      results.forEach((result, _i) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to delete old reference image:`,
            result.reason,
          );
        }
      });
    });

    return updatedServiceRequest;
  }

  return dbFactory.updateDocumentOrThrow(ServiceRequest, filter, updateData);
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
