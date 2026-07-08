import { QueryFilter } from 'mongoose';

import { Category } from '../../models/category.model.js';
import { Listing } from '../../models/listing.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import {
  embedDocument,
  embedQuery,
} from '../../services/ai/embedding.service.js';
import {
  rerankCandidates,
  type RerankableCandidate,
} from '../../services/ai/reranker.service.js';
import { generateTagsFromAI } from '../../services/ai/tagger.service.js';
import { AppError } from '../../utils/appError.js';
import { deleteImage, uploadImage } from '../../utils/cloudinary.js';
import * as dbFactory from '../../utils/dbFactory.js';
import { ListingSearchFeatures } from '../../utils/listingSearchFeatures.js';
import { paginateInMemory } from '../../utils/paginateInMemory.js';
import {
  CreateSkillListingInput,
  SkillListingQuery,
  UpdateSkillListingInput,
} from './skillListing.schema.js';

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

const queueEmbeddingGeneration = (
  listingId: unknown,
  title: string,
  description: string,
  categoryName: string,
) => {
  embedDocument(`${title}\n${description}\n${categoryName}`)
    .then(async (vector) => {
      if (vector.length > 0) {
        await SkillListing.findByIdAndUpdate(listingId, {
          $set: { embedding: vector },
        });
      }
    })
    .catch((err) =>
      console.error(`[EmbeddingService] Failed for listing ${listingId}:`, err),
    );
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

  queueEmbeddingGeneration(
    listing._id,
    listing.title,
    listing.description ?? '',
    categoryName,
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
  if (query.smartSearch) {
    const vector = await embedQuery(query.smartSearch);

    if (vector.length === 0) {
      return paginateInMemory([], query);
    }

    const candidates = await new ListingSearchFeatures<RerankableCandidate>(
      Listing,
      query,
      'SkillListing',
    )
      .vectorSearch(vector)
      .matchType()
      .filter()
      .lookupRelations()
      .limitFields()
      .execCandidates();

    const reranked = await rerankCandidates(query.smartSearch, candidates);
    return paginateInMemory(reranked, query);
  }

  return new ListingSearchFeatures(Listing, query, 'SkillListing')
    .atlasSearch()
    .matchType()
    .filter()
    .lookupRelations()
    .sort()
    .limitFields()
    .paginate()
    .exec();
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

    queueEmbeddingGeneration(
      updatedSkillListing._id,
      updatedSkillListing.title,
      updatedSkillListing.description ?? '',
      category,
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
