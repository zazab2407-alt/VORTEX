import { body } from 'express-validator';

const IMAGE_URL = /^(https?:\/\/\S+|\/uploads\/\S+)$/i;

export function categoryBody({ partial = false } = {}) {
  const name = body('name');
  return [
    (partial ? name.optional() : name.exists({ checkNull: true }).withMessage('Category name is required')).bail()
      .isString().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2 to 60 characters'),
    body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }).withMessage('Description is too long (max 500)'),
    body('image').optional({ values: 'falsy' }).isString().trim().matches(IMAGE_URL).withMessage('Image must be an http(s) URL or an /uploads/ path'),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  ];
}
