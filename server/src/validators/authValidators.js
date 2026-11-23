import { body } from 'express-validator';

// bcrypt only uses the first 72 BYTES of a password, so longer ones are refused rather than silently truncated
const passwordRules = (field, label = 'Password') =>
  body(field).isString().withMessage(`${label} is required`)
    .bail().isLength({ min: 8 }).withMessage(`${label} must be at least 8 characters`)
    .bail().custom((v) => Buffer.byteLength(v, 'utf8') <= 72).withMessage(`${label} is too long (max 72 characters)`);

export const registerBody = [
  body('name').isString().withMessage('Name is required').bail().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  body('email').isString().withMessage('Email is required').bail().trim().isEmail().withMessage('Please enter a valid email address').isLength({ max: 254 }).withMessage('Email is too long'),
  passwordRules('password'),
];

export const loginBody = [
  body('email').isString().withMessage('Email is required').bail().trim().notEmpty().withMessage('Email is required'),
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required').isLength({ max: 200 }),
];

export const profileBody = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  body('phone').optional({ values: 'falsy' }).isString().trim().matches(/^[0-9+()\-\s.]{6,30}$/).withMessage('Please enter a valid phone number'),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('Address is too long (max 300 characters)'),
  body('city').optional({ values: 'falsy' }).isString().trim().isLength({ max: 80 }).withMessage('City is too long (max 80 characters)'),
];

export const passwordBody = [
  body('currentPassword').isString().withMessage('Current password is required').bail().notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword', 'New password'),
  body('newPassword').custom((v, { req }) => v !== req.body.currentPassword).withMessage('New password must be different from the current one'),
];
