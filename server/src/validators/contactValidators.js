import { body } from 'express-validator';
import { isPlainEmail } from '../config/settings.js';

export const CONTACT_TOPICS = ['order', 'product', 'returns', 'feedback', 'other'];

export const contactBody = [
  body('name').isString().withMessage('Please enter your name').bail().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  body('email').isString().withMessage('Please enter your email address').bail().trim().custom(isPlainEmail).withMessage('Please enter a valid email address'),
  body('topic').optional({ values: 'falsy' }).isIn(CONTACT_TOPICS).withMessage(`Topic must be one of: ${CONTACT_TOPICS.join(', ')}`),
  body('message').isString().withMessage('Please write a message').bail().trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be 10 to 2000 characters'),
  body('website').optional({ values: 'falsy' }).isString().isLength({ max: 200 }), // honeypot: real visitors never see or fill it
];
