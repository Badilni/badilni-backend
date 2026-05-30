import type { Model, QueryFilter } from 'mongoose';
import { AppError } from '../utils/appError.js';
import { APIFeatures } from '../utils/apiFeatures.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getResourceName = <T>(Model: Model<T>) => Model.modelName.toLowerCase();

export const getOne = <T>(Model: Model<T>) =>
  asyncHandler(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (typeof req.query.fields === 'string') {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    }

    const doc = await query;
    const resource = getResourceName(Model);
    if (!doc) {
      return next(new AppError(`No ${resource} found with this id`, 404));
    }

    res.status(200).json({ status: 'success', data: { [resource]: doc } });
  });

export const getAll = <T>(Model: Model<T>, searchFields: string[]) =>
  asyncHandler(async (req, res, _next) => {
    const {
      docs,
      paginationResult: { totalCount, totalPages, page, limit },
    } = await new APIFeatures(Model.find(), req.query, searchFields)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate()
      .exec();

    const resource = getResourceName(Model);

    res.status(200).json({
      status: 'success',
      data: { [resource]: docs },
      pagination: { totalCount, totalPages, page, limit },
    });
  });

export const createOne = <T>(Model: Model<T>) =>
  asyncHandler(async (req, res, _next) => {
    const doc = await Model.create(req.body);
    const resourceName = getResourceName(Model);

    res.status(201).json({
      status: 'success',
      data: {
        [resourceName]: doc,
      },
    });
  });

export const updateOne = <T>(
  Model: Model<T>,
  ownerField: string | null = null,
) =>
  asyncHandler(async (req, res, next) => {
    const resourceName = getResourceName(Model);

    const filter: QueryFilter<T> & Record<string, unknown> = {
      _id: req.params.id,
    };
    if (ownerField && req.user?.role !== 'admin') {
      if (!req.user) {
        return next(new AppError('You are not logged in', 401));
      }
      filter[ownerField] = req.user.id;
    }

    const doc = await Model.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError(`No ${resourceName} found with that ID`, 404));
    }

    res.status(200).json({
      status: 'success',
      data: { [resourceName]: doc },
    });
  });

export const deleteOne = <T>(
  Model: Model<T>,
  ownerField: string | null = null,
) =>
  asyncHandler(async (req, res, next) => {
    const resourceName = getResourceName(Model);

    const filter: QueryFilter<T> & Record<string, unknown> = {
      _id: req.params.id,
    };
    if (ownerField && req.user?.role !== 'admin') {
      if (!req.user) {
        return next(new AppError('You are not logged in', 401));
      }
      filter[ownerField] = req.user.id;
    }

    const doc = await Model.findOneAndDelete(filter);

    if (!doc) {
      return next(new AppError(`No ${resourceName} found with that ID`, 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
