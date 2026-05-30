import { ErrorRequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { AppError } from '../utils/appError.js';

interface MongoDuplicateKeyError {
  code: number;
  keyValue: Record<string, unknown>;
}

interface OperationalError {
  statusCode: number;
  status: string;
  message: string;
  stack?: string;
  isOperational?: boolean;
}

const handleValidationError = (
  err: MongooseError.ValidationError,
): AppError => {
  const message = Object.values(err.errors)
    .map((v) => v.message)
    .join('. ');

  return new AppError(message, 400);
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

const sendErrorDev = (err: OperationalError, res: Response): void => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: OperationalError, res: Response): void => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error('Error 💥', err);
    res.status(500).json({ status: 'error', message: 'Something went wrong!' });
  }
};

const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err as OperationalError, res);
    return;
  }

  let error: OperationalError;

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
  } else {
    error = err as OperationalError;
  }

  sendErrorProd(error, res);
};

export default globalErrorHandler;
