import { body, param, query } from 'express-validator';
import { COLLECTIONS, MAX_LIMIT, SORTS } from '../utils/productQuery.js';
import { GENDERS } from '../models/Product.js';
import { OBJECT_ID, isObjectId } from '../utils/objectId.js';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const IMAGE_URL = /^(https?:\/\/\S+|\/(?:uploads|images)\/\S+)$/i; // /images/ = the locally hosted catalogue photos (client/public/images)

export const productListQuery = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive whole number').toInt(),
  query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).withMessage(`limit must be between 1 and ${MAX_LIMIT}`).toInt(),
  query('sort').optional().isIn(Object.keys(SORTS)).withMessage(`sort must be one of: ${Object.keys(SORTS).join(', ')}`),
  query('collection').optional().isIn(COLLECTIONS).withMessage(`collection must be one of: ${COLLECTIONS.join(', ')}`),
  query('gender').optional().isIn(GENDERS).withMessage(`gender must be one of: ${GENDERS.join(', ')}`),
  query('exactGender').optional().isBoolean().withMessage('exactGender must be true or false').toBoolean(),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a number of 0 or more').toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a number of 0 or more').toFloat()
    .custom((v, { req }) => req.query.minPrice === undefined || v >= req.query.minPrice).withMessage('maxPrice must not be lower than minPrice'),
  query('q').optional().isString().trim().isLength({ max: 80 }).withMessage('Search text is too long (max 80 characters)'),
  query('category').optional().isString().trim().isLength({ max: 60 }).withMessage('Invalid category'),
  query('size').optional().isString().trim().isLength({ max: 12 }).withMessage('Invalid size'),
  query('color').optional().isString().trim().isLength({ max: 30 }).withMessage('Invalid colour'),
  query('ids').optional()
    .customSanitizer((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean))
    .custom((arr) => arr.length <= MAX_LIMIT && arr.every(isObjectId)).withMessage(`ids must be up to ${MAX_LIMIT} valid product ids`),
];

export const idOrSlugParam = [param('idOrSlug').isString().trim().isLength({ min: 1, max: 140 }).withMessage('Invalid product identifier')];
export const idParam = [param('id').matches(OBJECT_ID).withMessage('Invalid id')];
export const relatedQuery = [query('limit').optional().isInt({ min: 1, max: 12 }).withMessage('limit must be between 1 and 12').toInt()];

const unique = (label) => (arr) => new Set(arr).size === arr.length || Promise.reject(new Error(`${label} must not contain duplicates`));

/** `partial` = PATCH-style update: every field optional, but whatever is sent must be valid. */
export function productBody({ partial = false } = {}) {
  const f = (chain) => (partial ? chain.optional() : chain.exists({ checkNull: true }).withMessage('This field is required'));
  return [
    f(body('name')).bail().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2 to 120 characters'),
    f(body('description')).bail().isString().trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10 to 2000 characters'),
    f(body('price')).bail().isFloat({ min: 0, max: 100000 }).withMessage('Price must be a number from 0 to 100000').toFloat(),
    body('salePrice').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }).withMessage('Sale price must be a number from 0 to 100000').toFloat(),
    f(body('images')).bail().isArray({ min: 1, max: 10 }).withMessage('Provide 1 to 10 images'),
    body('images.*').optional().isString().trim().matches(IMAGE_URL).withMessage('Each image must be an http(s) URL or an /uploads/ or /images/ path').isLength({ max: 500 }),
    f(body('category')).bail().matches(OBJECT_ID).withMessage('category must be a valid category id'),
    f(body('gender')).bail().isIn(GENDERS).withMessage(`Gender must be one of: ${GENDERS.join(', ')}`),
    f(body('sizes')).bail().isArray({ min: 1, max: 12 }).withMessage('Provide 1 to 12 sizes').bail().custom(unique('sizes')),
    body('sizes.*').optional().isString().trim().isLength({ min: 1, max: 12 }).withMessage('Each size must be 1 to 12 characters'),
    f(body('colors')).bail().isArray({ min: 1, max: 20 }).withMessage('Provide 1 to 20 colours')
      .bail().custom((arr) => new Set(arr.map((c) => c?.name)).size === arr.length).withMessage('Colour names must be unique'),
    body('colors.*.name').optional().isString().trim().isLength({ min: 1, max: 30 }).withMessage('Each colour needs a name'),
    body('colors.*.hex').optional().matches(HEX).withMessage('Colour hex must look like #FF5A1F'),
    body('variants').optional().isArray({ max: 300 }).withMessage('variants must be a list'),
    body('variants.*.size').optional().isString().trim().notEmpty().withMessage('Each variant needs a size'),
    body('variants.*.color').optional().isString().trim().notEmpty().withMessage('Each variant needs a colour'),
    body('variants.*.stock').optional().isInt({ min: 0, max: 100000 }).withMessage('Stock must be a whole number of 0 or more').toInt(),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be true or false').toBoolean(),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  ];
}

export const stockBody = [
  body('size').isString().trim().notEmpty().withMessage('size is required'),
  body('color').isString().trim().notEmpty().withMessage('color is required'),
  body('stock').isInt({ min: 0, max: 100000 }).withMessage('Stock must be a whole number of 0 or more').toInt(),
];
