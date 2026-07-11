import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { Listing } from '../../models/listing.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { User } from '../../models/user.model.js';
import {
  embedDocument,
  embedQuery,
} from '../../services/ai/embedding.service.js';
import {
  rerankSmartSearchCandidates,
  type RerankableCandidate,
} from '../../services/ai/smartSearchReranker.service.js';
import { generateTagsFromAI } from '../../services/ai/tagger.service.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import { ListingSearchFeatures } from '../../utils/listingSearchFeatures.js';
import { paginateInMemory } from '../../utils/paginateInMemory.js';
import {
  CreateServiceRequestInput,
  ServiceRequestQuery,
  UpdateServiceRequestInput,
} from './serviceRequest.schema.js';
import { runMatchmakerForLoadedRequest } from '../match/match.service.js';

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

const queueTagGeneration = (
  listingId: unknown,
  categoryName: string,
  title: string,
  description: string,
  operation: 'create' | 'update',
) => {
  generateTagsFromAI(categoryName, title, description)
    .then(async (tags) => {
      if (tags.length > 0) {
        await ServiceRequest.findByIdAndUpdate(listingId, { $set: { tags } });
      }
    })
    .catch((err) =>
      console.error(
        `[TagSuggester] Failed on ${operation} for service request ${listingId}:`,
        err,
      ),
    );
};

const queueEmbeddingGeneration = (
  listingId: unknown,
  title: string,
  description: string,
  categoryName: string,
  operation: 'create' | 'update',
) => {
  embedDocument(`${title}\n${description}\n${categoryName}`)
    .then(async (vector) => {
      if (vector.length > 0) {
        await ServiceRequest.findByIdAndUpdate(listingId, {
          $set: { embedding: vector },
        });
      }
    })
    .catch((err) =>
      console.error(
        `[EmbeddingService] Failed on ${operation} for listing ${listingId}:`,
        err,
      ),
    );
};

export const createServiceRequest = async (
  userId: string,
  data: CreateServiceRequestInput,
  files?: Express.Multer.File[],
) => {
  await ensureSufficientWalletBalance(userId, data.creditsOffered);
  const categoryName = await ensureCategoryExists(data.category);
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

  queueTagGeneration(
    listing._id,
    categoryName,
    listing.title,
    listing.description ?? '',
    'create',
  );

  queueEmbeddingGeneration(
    listing._id,
    listing.title,
    listing.description ?? '',
    categoryName,
    'create',
  );

  runMatchmakerForLoadedRequest({
    _id: listing._id,
    user: listing.user,
    title: listing.title,
    description: listing.description,
    status: listing.status,
    category: { name: categoryName },
  }).catch((err) =>
    console.error('[Matchmaker] On-demand failed for', listing._id, err),
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
  if (query.smartSearch) {
    const vector = await embedQuery(query.smartSearch);

    if (vector.length === 0) {
      return paginateInMemory([], query);
    }

    const candidates = await new ListingSearchFeatures<RerankableCandidate>(
      Listing,
      query,
      'ServiceRequest',
    )
      .vectorSearch(vector)
      .matchType()
      .filter()
      .lookupUserRelation()
      .lookupCategoryRelation()
      .limitFields()
      .execCandidates();

    const reranked = await rerankSmartSearchCandidates(
      query.smartSearch,
      candidates,
    );
    return paginateInMemory(reranked, query);
  }

  return new ListingSearchFeatures(Listing, query, 'ServiceRequest')
    .atlasSearch()
    .matchType()
    .filter()
    .lookupUserRelation()
    .lookupCategoryRelation()
    .sort()
    .limitFields()
    .paginate()
    .exec();
};

export const updateServiceRequest = async (
  id: string,
  user: CurrentUser,
  data: UpdateServiceRequestInput,
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

  if (data.title || data.description || data.category) {
    const category =
      categoryName ||
      (
        await updatedServiceRequest.populate<{ category: { name: string } }>(
          'category',
          'name',
        )
      ).category.name;

    queueTagGeneration(
      updatedServiceRequest._id,
      category,
      updatedServiceRequest.title,
      updatedServiceRequest.description || '',
      'update',
    );

    queueEmbeddingGeneration(
      updatedServiceRequest._id,
      updatedServiceRequest.title,
      updatedServiceRequest.description || '',
      category,
      'update',
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
