import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/** Place after express-validator chains: turns validation failures into a 400 with per-field messages. */
export default function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest(errors[0].message, errors));
}
