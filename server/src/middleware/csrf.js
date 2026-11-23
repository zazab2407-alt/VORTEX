import ApiError from '../utils/ApiError.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence in depth on top of SameSite cookies: every state-changing request must carry a custom header.
 * Browsers only allow a cross-site page to add one after a CORS preflight, which our origin allow-list refuses.
 */
export default function requireCustomHeader(req, _res, next) {
  if (SAFE.has(req.method) || req.get('x-requested-with') === 'vortex-web') return next();
  next(ApiError.forbidden('Missing required request header'));
}
