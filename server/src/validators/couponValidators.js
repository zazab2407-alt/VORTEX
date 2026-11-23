import { body, query } from 'express-validator';
import { COUPON_TYPES } from '../models/Coupon.js';

const CODE = /^[A-Za-z0-9_-]{3,30}$/;
export const COUPON_STATES = ['active', 'inactive', 'expired', 'exhausted'];

/**
 * Admin coupon input. `partial` = PATCH: every field optional, but whatever is sent must be valid.
 * The admin only ever sets RULES (type, value, minimum, expiry, limit); the discount a shopper gets is always
 * recalculated on the server at checkout, and `usedCount` can never be set from outside.
 */
export function couponBody({ partial = false } = {}) {
  const f = (chain) => (partial ? chain.optional() : chain.exists({ checkNull: true }).withMessage('This field is required'));
  return [
    f(body('code')).bail().isString().trim().matches(CODE).withMessage('Code must be 3 to 30 letters, numbers, - or _'),
    f(body('type')).bail().isIn(COUPON_TYPES).withMessage(`Type must be one of: ${COUPON_TYPES.join(', ')}`),
    f(body('value')).bail().isFloat({ min: 0.01, max: 100000 }).withMessage('Discount value must be a number greater than 0').toFloat(),
    body('minSubtotal').optional({ values: 'null' }).isFloat({ min: 0, max: 1000000 }).withMessage('Minimum order must be a number of 0 or more').toFloat(),
    body('expiresAt').optional({ values: 'falsy' }).isString().isLength({ max: 40 }).custom((v) => !Number.isNaN(Date.parse(v))).withMessage('Expiry must be a date like 2026-12-31'),
    body('usageLimit').optional({ values: 'null' }).isInt({ min: 1, max: 1000000 }).withMessage('Usage limit must be a whole number of 1 or more').toInt(),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  ];
}

export const couponListQuery = [
  query('q').optional().isString().trim().isLength({ max: 30 }).withMessage('Search text is too long (max 30 characters)'),
  query('status').optional().isIn(COUPON_STATES).withMessage(`status must be one of: ${COUPON_STATES.join(', ')}`),
];
