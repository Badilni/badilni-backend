import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { AppError } from '../utils/appError.js';

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
});
