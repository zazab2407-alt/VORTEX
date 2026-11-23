import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`));
}

/** Single place where every error becomes a consistent { success:false, message, errors? } response. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let errors = err.errors;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = err.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Invalid authentication token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body contains invalid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB)' : err.message;
  }

  if (status >= 500) {
    console.error('[error]', err);
    if (config.isProd) message = 'Something went wrong on our side. Please try again.';
  }
  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (process.env.NODE_ENV === 'development' && status >= 500) body.stack = err.stack; // only when explicitly in development: never in production, test, or when NODE_ENV is unset
  res.status(status).json(body);
}
