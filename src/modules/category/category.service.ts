import slugify from 'slugify';

import { Category } from '../../models/category.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import * as adminActionService from '../adminAction/adminAction.service.js';
import { CreateCategoryInput, UpdateCategoryInput } from './category.schema.js';

export const createCategory = async (
  data: CreateCategoryInput,
  adminId: string,
) => {
  const category = await dbFactory.createDocument(Category, data);

  adminActionService.logAction({
    adminId,
    action: 'create_category',
    targetId: category._id.toString(),
    targetModel: 'Category',
    details: { name: category.name },
  });

  return category;
};

export const getCategory = async (id: string) => {
  return dbFactory.findByIdOrThrow(Category, id);
};

export const getAllCategories = async (
  queryString: Record<string, unknown>,
) => {
  return dbFactory.findMany(Category.find(), queryString, ['name', 'slug']);
};

export const updateCategory = async (
  id: string,
  data: UpdateCategoryInput,
  adminId: string,
) => {
  const updateData = {
    ...data,
    ...(data.name
      ? { slug: slugify(data.name, { strict: true, lower: true }) }
      : {}),
  };

  const category = await dbFactory.updateDocumentOrThrow(
    Category,
    { _id: id },
    updateData,
  );

  adminActionService.logAction({
    adminId,
    action: 'update_category',
    targetId: id,
    targetModel: 'Category',
    details: updateData,
  });

  return category;
};

export const deleteCategory = async (id: string, adminId: string) => {
  await dbFactory.deleteDocumentOrThrow(Category, { _id: id });

  adminActionService.logAction({
    adminId,
    action: 'delete_category',
    targetId: id,
    targetModel: 'Category',
  });
};
