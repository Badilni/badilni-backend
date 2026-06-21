import type {
  Model,
  Query,
  QueryFilter,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';
import { APIFeatures } from './apiFeatures.js';
import { AppError } from './appError.js';

export interface FieldSelectionOptions {
  fields?: string;
}

interface OwnerScopedUser {
  id: string;
  role?: string;
}

interface OwnerScopedFilterOptions {
  ownerField?: string | null;
  user?: OwnerScopedUser;
}

interface FindManyResult<T> {
  docs?: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount?: number;
    totalPages?: number;
  };
}

export const getResourceName = <T>(Model: Model<T>) =>
  Model.modelName.toLowerCase();

export const buildOwnerScopedFilter = <T>(
  id: string,
  { ownerField = null, user }: OwnerScopedFilterOptions = {},
) => {
  const filter: QueryFilter<T> & Record<string, unknown> = { _id: id };

  if (!ownerField || user?.role === 'admin') {
    return filter;
  }

  if (!user) {
    throw new AppError('You are not logged in', 401);
  }

  filter[ownerField] = user.id;
  return filter;
};

export const findByIdOrThrow = async <T>(
  Model: Model<T>,
  id: string,
  options: FieldSelectionOptions = {},
) => {
  return findDocumentOrThrow(Model.findById(id), options);
};

export const findDocumentOrThrow = async <T>(
  mongooseQuery: Query<T, any>,
  { fields }: FieldSelectionOptions = {},
) => {
  const query = fields
    ? mongooseQuery.select(fields.split(',').join(' '))
    : mongooseQuery;

  const doc = (await query) as T | null;
  if (!doc) {
    throw new AppError(
      `No ${getResourceName(mongooseQuery.model)} found with this id`,
      404,
    );
  }

  return doc;
};

export const findMany = async <T>(
  mongooseQuery: Query<T[], any>,
  queryString: Record<string, unknown>,
  searchFields: string[] = ['name'],
): Promise<FindManyResult<T>> => {
  const {
    docs,
    paginationResult: { totalCount, totalPages, page, limit },
  } = await new APIFeatures<T>(mongooseQuery, queryString, searchFields)
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

export const createDocument = async <T>(Model: Model<T>, data: Partial<T>) =>
  Model.create(data);

export const updateDocumentOrThrow = async <T>(
  Model: Model<T>,
  filter: QueryFilter<T>,
  data: UpdateQuery<T>,
  options: QueryOptions = {},
) => {
  const doc = await Model.findOneAndUpdate(filter, data, {
    returnDocument: 'after',
    runValidators: true,
    ...options,
  });

  if (!doc) {
    throw new AppError(`No ${getResourceName(Model)} found with that ID`, 404);
  }

  return doc;
};

export const deleteDocumentOrThrow = async <T>(
  Model: Model<T>,
  filter: QueryFilter<T>,
) => {
  const doc = await Model.findOneAndDelete(filter);

  if (!doc) {
    throw new AppError(`No ${getResourceName(Model)} found with that ID`, 404);
  }

  return doc;
};
