import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const make = (windowMs, limit, message, extra = {}) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, skip: () => config.env === 'test', message: { success: false, message }, ...extra });

/** Applied to every /api request. */
export const apiLimiter = make(15 * 60 * 1000, 300, 'Too many requests. Please try again in a few minutes.');
/** Login, register and password change: 10 FAILED attempts per 15 minutes per IP (successful ones are not counted). */
export const authLimiter = make(15 * 60 * 1000, 10, 'Too many attempts. Please try again in 15 minutes.', { skipSuccessfulRequests: true });
/** Guest order lookups: 10 FAILED lookups per 15 minutes per IP, so order numbers cannot be guessed. */
export const trackLimiter = make(15 * 60 * 1000, 10, 'Too many lookups. Please try again in 15 minutes.', { skipSuccessfulRequests: true });
/** Order placement and contact/newsletter style writes. */
export const writeLimiter = make(60 * 60 * 1000, 30, 'Too many submissions. Please try again later.');
/** Contact form: 5 messages per hour per IP. */
export const contactLimiter = make(60 * 60 * 1000, 5, 'You have sent several messages already. Please try again in an hour.');
