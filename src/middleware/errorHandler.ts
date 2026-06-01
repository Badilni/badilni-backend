import { ErrorRequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';
import { ValidationError, ValidationIssue } from '../utils/validationError.js';

interface MongoDuplicateKeyError {
  code: number;
  keyValue: Record<string, unknown>;
}

const handleValidationError = (
  err: MongooseError.ValidationError,
): ValidationError => {
  const errors: ValidationIssue[] = Object.values(err.errors).map((el) => ({
    path: el.path,
    message: el.message,
    code: el.kind,
  }));

  return new ValidationError(errors);
};

const handleCastError = (err: MongooseError.CastError): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateError = (err: MongoDuplicateKeyError): AppError => {
  const fields = Object.keys(err.keyValue).join(', ');
  const values = Object.values(err.keyValue).join(', ');
  const message = `Duplicate value inserted for [${fields}] - "${values}" already exists.`;

  return new AppError(message, 400);
};

const handleJWTError = (): AppError =>
  new AppError('Invalid token. Please log in again', 401);

const handleJWTExpires = (): AppError =>
  new AppError('Your token has expired. Please log in again', 401);

const handleZodError = (err: ZodError): ValidationError => {
  const errors: ValidationIssue[] = err.issues.map(
    ({ path, message, code }) => ({
      path: path.length > 0 ? path.join('.') : 'general',
      message,
      code,
    }),
  );

  return new ValidationError(errors);
};

const sendErrorDev = (err: any, res: Response): void => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    stack: err.stack,
    ...err,
  });
};

const sendErrorProd = (err: Error, res: Response): void => {
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json(err.serialize());
    return;
  }

  // Log unhandled programming/infrastructure errors
  console.error('Error 💥', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};

// 4. Main Global Error Middleware
const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Ensure basic operational properties exist for development tracking
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
    return;
  }

  let error: Error = err;

  if (err.name === 'ValidationError') {
    error = handleValidationError(err as MongooseError.ValidationError);
  } else if (err.name === 'CastError') {
    error = handleCastError(err as MongooseError.CastError);
  } else if ((err as MongoDuplicateKeyError).code === 11000) {
    error = handleDuplicateError(err as MongoDuplicateKeyError);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpires();
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  }

  sendErrorProd(error, res);
};

export default globalErrorHandler;
