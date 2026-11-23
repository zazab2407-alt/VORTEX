import { config } from '../config/env.js';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { clearAuthCookie, verifyToken } from '../utils/tokens.js';

/**
 * Identifies the caller from the login cookie. The user is re-loaded from the database on EVERY request, so a
 * deactivated account, a demoted admin or a changed password takes effect immediately; nothing in the token is trusted
 * except the user id.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[config.cookie.name];
  if (!token) throw ApiError.unauthorized();
  let payload;
  try { payload = verifyToken(token); } catch { throw ApiError.unauthorized('Your session has expired. Please log in again.'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Your session is no longer valid. Please log in again.');
  if ((payload.tv ?? 0) !== user.tokenVersion) throw ApiError.unauthorized('Your session has ended. Please log in again.');
  req.user = user;
  next();
});

/**
 * Checkout: a guest, or a signed-in customer. A visitor with no valid session continues as a guest.
 * A session that belongs to a deactivated account is refused, so a deactivated customer cannot place orders while signed in.
 * Guest checkout is unchanged: a guest may still order with the same email address.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[config.cookie.name];
  if (!token) return next();
  let payload;
  try { payload = verifyToken(token); } catch { return next(); } // expired or tampered cookie: continue as a guest
  const user = await User.findById(payload.sub);
  if (!user || (payload.tv ?? 0) !== user.tokenVersion) return next(); // unknown user or ended session: continue as a guest
  if (!user.isActive) {
    clearAuthCookie(res); // same cookie name and options as logout: the stale cookie is removed, so the next attempt can be a guest checkout
    return next(ApiError.forbidden('This account has been deactivated, so orders cannot be placed while signed in. Please contact the store.'));
  }
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());

/** Every admin operation goes through this: logged in AND role === "admin", decided on the server. */
export const requireAdmin = [authenticate, requireRole('admin')];
