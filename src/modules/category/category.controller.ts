import { asyncHandler } from '../../utils/asyncHandler.js';
import * as categoryService from './category.service.js';
import { CategoryParams } from './category.schema.js';

export const createCategory = asyncHandler(async (req, res, _next) => {
  const category = await categoryService.createCategory(req.body);
  res.status(201).json({ status: 'success', data: { category } });
});

export const getCategory = asyncHandler(async (req, res, _next) => {
  const category = await categoryService.getCategory(req.params.id as string);
  res.status(200).json({ status: 'success', data: { category } });
});

export const getAllCategories = asyncHandler(async (req, res, _next) => {
  const { docs: categories, pagination } =
    await categoryService.getAllCategories(req.query);

  res.status(200).json({
    status: 'success',
    pagination,
    data: { categories },
  });
});

export const updateCategory = asyncHandler(async (req, res, _next) => {
  const category = await categoryService.updateCategory(
    (req.params as CategoryParams).id,
    req.body,
  );
  res.status(200).json({ status: 'success', data: { category } });
});

export const deleteCategory = asyncHandler(async (req, res, _next) => {
  await categoryService.deleteCategory((req.params as CategoryParams).id);
  res.sendStatus(204);
});
