import { body, query } from 'express-validator';

export const customerListQuery = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive whole number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').toInt(),
  query('q').optional().isString().trim().isLength({ max: 80 }).withMessage('Search text is too long (max 80 characters)'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive'),
];

export const customerStatusBody = [body('isActive').isBoolean({ strict: true }).withMessage('isActive must be true or false')];
