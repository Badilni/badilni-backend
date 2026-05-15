import { AppError } from '../utils/appError.js';
import { APIFeatures } from '../utils/apiFeatures.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getResourceName = (Model) => Model.modelName.toLowerCase();

export const getOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields).lean();
    }

    const doc = await query;
    const resource = getResourceName(Model);
    if (!doc) {
      return next(new AppError(`No ${resource} found with this id`, 404));
    }

    res.status(200).json({ status: 'success', data: { [resource]: doc } });
  });

export const getAll = (Model, searchFields) =>
  asyncHandler(async (req, res, next) => {
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

export const createOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const doc = await Model.create(req.body);
    const resourceName = getResourceName(Model);

    res.status(201).json({
      status: 'success',
      data: {
        [resourceName]: doc,
      },
    });
  });

export const updateOne = (Model, ownerField = null) =>
  asyncHandler(async (req, res, next) => {
    const resourceName = getResourceName(Model);

    const filter = { _id: req.params.id };
    if (ownerField && req.user?.role !== 'admin') {
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

export const deleteOne = (Model, ownerField = null) =>
  asyncHandler(async (req, res, next) => {
    const resourceName = getResourceName(Model);

    const filter = { _id: req.params.id };
    if (ownerField && req.user?.role !== 'admin') {
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
