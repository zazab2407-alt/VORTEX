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

/**
 * Per-ACCOUNT login throttle (approved design): 30 FAILED attempts per email within a fixed 15-minute window. It applies
 * to every email address the same way, existing or not, so the response reveals nothing about whether an account exists.
 * There is no permanent lockout: the window simply expires. Successful logins are not counted. The per-IP limiter above
 * still applies on top of this.
 */
export const ACCOUNT_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_LOGIN_LIMIT = 30;
/** Key: the normalised email when one is supplied, otherwise the client IP (so malformed requests cannot share one bucket). */
const accountKey = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email ? `account:${email}` : `ip:${req.ip}`;
};
export const createAccountLoginLimiter = ({ windowMs = ACCOUNT_LOGIN_WINDOW_MS, limit = ACCOUNT_LOGIN_LIMIT } = {}) =>
  make(windowMs, limit, 'Too many attempts. Please try again in 15 minutes.', { skipSuccessfulRequests: true, keyGenerator: accountKey });
export const loginAccountLimiter = createAccountLoginLimiter();
