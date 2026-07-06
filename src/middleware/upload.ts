import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { AppError } from '../utils/appError.js';

const storage = multer.memoryStorage();

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400));
  }
};

const anyFileFilter = (
  _req: Request,
  _file: Express.Multer.File,
  cb: FileFilterCallback,
) => cb(null, true);

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
});

export const uploadAny = multer({
  storage,
  fileFilter: anyFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});
