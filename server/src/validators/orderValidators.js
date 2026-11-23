import { body, param, query } from 'express-validator';
import { ORDER_STATUSES } from '../models/Order.js';
import { OBJECT_ID } from '../utils/objectId.js';

const ORDER_NUMBER = /^VTX-\d{6}-[A-Z2-9]{8}$/;
const PHONE = /^[0-9+()\-\s.]{6,30}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const itemRules = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('Your cart is empty or has too many items (max 50)'),
  body('items.*.productId').matches(OBJECT_ID).withMessage('Invalid product in cart'),
  body('items.*.size').isString().trim().isLength({ min: 1, max: 12 }).withMessage('Invalid size in cart'),
  body('items.*.color').isString().trim().isLength({ min: 1, max: 30 }).withMessage('Invalid colour in cart'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Quantity must be a whole number from 1 to 99').toInt(),
  body('couponCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }).withMessage('Invalid coupon code'),
];

export const quoteBody = itemRules;

export const createOrderBody = [
  ...itemRules,
  body('customer.fullName').isString().withMessage('Full name is required').bail().trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2 to 100 characters'),
  body('customer.email').isString().withMessage('Email is required').bail().trim().isEmail().withMessage('Please enter a valid email address').isLength({ max: 254 }).withMessage('Email is too long'),
  body('customer.phone').isString().withMessage('Phone number is required').bail().trim().matches(PHONE).withMessage('Please enter a valid phone number')
    .bail().custom((v) => (v.match(/\d/g) ?? []).length >= 6).withMessage('Please enter a valid phone number'),
  body('shippingAddress.city').isString().withMessage('City is required').bail().trim().isLength({ min: 2, max: 80 }).withMessage('City must be 2 to 80 characters'),
  body('shippingAddress.address').isString().withMessage('Shipping address is required').bail().trim().isLength({ min: 5, max: 300 }).withMessage('Please enter your full shipping address (5 to 300 characters)'),
  body('shippingAddress.notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }).withMessage('Notes are too long (max 500 characters)'),
  body('paymentMethod').optional().equals('cod').withMessage('Online payment is not available yet. Please choose Cash on Delivery.'),
  body('idempotencyKey').optional().matches(/^[A-Za-z0-9_-]{16,64}$/).withMessage('Invalid submission key'),
];

export const lookupBody = [
  body('orderNumber').isString().trim().toUpperCase().matches(ORDER_NUMBER).withMessage('Please enter a valid order number (like VTX-261111-ABCD2345)'),
  body('email').isString().trim().isEmail().withMessage('Please enter the email used for the order'),
];
export const orderNumberParam = [param('orderNumber').customSanitizer((v) => String(v).toUpperCase()).matches(ORDER_NUMBER).withMessage('Invalid order number')];

export const adminOrderQuery = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive whole number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').toInt(),
  query('status').optional().isIn(ORDER_STATUSES).withMessage(`status must be one of: ${ORDER_STATUSES.join(', ')}`),
  query('q').optional().isString().trim().isLength({ max: 80 }).withMessage('Search text is too long (max 80 characters)'),
  query('from').optional().matches(DATE).withMessage('from must be a date like 2026-11-01'),
  query('to').optional().matches(DATE).withMessage('to must be a date like 2026-11-30'),
  query('sort').optional().isIn(['newest', 'oldest']).withMessage('sort must be newest or oldest'),
];
export const statusBody = [
  body('status').isIn(ORDER_STATUSES).withMessage(`status must be one of: ${ORDER_STATUSES.join(', ')}`),
  body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('Note is too long (max 300 characters)'),
];
