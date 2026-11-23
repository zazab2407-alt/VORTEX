import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { toMs } from './duration.js';

const ALGORITHM = 'HS256';

export function signToken(user) {
  return jwt.sign({ tv: user.tokenVersion ?? 0 }, config.jwt.secret, { subject: String(user._id), expiresIn: config.jwt.expiresIn, algorithm: ALGORITHM });
}

/** Throws on any bad, expired or tampered token. The algorithm is pinned, so "alg: none" tokens are refused. */
export const verifyToken = (token) => jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });

const cookieOptions = () => ({ httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, path: '/' });

/** The token lives in an httpOnly cookie: page scripts (and so XSS) can never read it. */
export function setAuthCookie(res, user) {
  res.cookie(config.cookie.name, signToken(user), { ...cookieOptions(), maxAge: toMs(config.jwt.expiresIn) });
}
export const clearAuthCookie = (res) => res.clearCookie(config.cookie.name, cookieOptions());
