import slugify from 'slugify';

import { Category } from '../../models/category.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.schema.js';

export const createCategory = async (data: CreateCategoryInput) => {
  return dbFactory.createDocument(Category, data);
};

export const getCategory = async (id: string) => {
  return dbFactory.findByIdOrThrow(Category, id);
};

export const getAllCategories = async (queryString: Record<string, unknown>) => {
  return dbFactory.findMany(Category, queryString, ['name', 'slug']);
};

export const updateCategory = async (
  id: string,
  data: UpdateCategoryInput,
) => {
  const updateData = {
    ...data,
    ...(data.name ? { slug: slugify(data.name, { strict: true, lower: true }) } : {}),
  };

  return dbFactory.updateDocumentOrThrow(Category, { _id: id }, updateData);
};

export const deleteCategory = async (id: string) => {
  return dbFactory.deleteDocumentOrThrow(Category, { _id: id });
};
