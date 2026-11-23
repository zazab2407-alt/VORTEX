import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { clearAuthCookie, setAuthCookie } from '../utils/tokens.js';
import { serializeUser } from '../utils/serializers.js';

// Compared against when the email is unknown, so "no such user" and "wrong password" take the same time
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);
const BAD_LOGIN = 'Invalid email or password';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body; // role is never read from the request: everyone registers as a customer
  const user = await User.create({ name, email, password });
  setAuthCookie(res, user);
  res.status(201).json({ success: true, data: { user: serializeUser(user) } });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email).trim().toLowerCase() }).select('+password');
  const ok = await bcrypt.compare(req.body.password, user?.password ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw ApiError.unauthorized(BAD_LOGIN);
  setAuthCookie(res, user);
  res.json({ success: true, data: { user: serializeUser(user) } });
});

export const logout = (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
};

/** "Is anyone logged in?" probe for the storefront: answers 200 either way, so anonymous shoppers never trigger a 401. */
export const session = (req, res, next) =>
  authenticate(req, res, (err) => {
    if (!err) return res.json({ success: true, data: { user: serializeUser(req.user) } });
    if (err.status === 401) return res.json({ success: true, data: { user: null } });
    next(err);
  });

export const me = (req, res) => res.json({ success: true, data: { user: serializeUser(req.user) } });

export const updateMe = asyncHandler(async (req, res) => {
  for (const k of ['name', 'phone', 'address', 'city']) if (req.body[k] !== undefined) req.user[k] = req.body[k]; // email, role, isActive can never be changed here
  await req.user.save();
  res.json({ success: true, data: { user: serializeUser(req.user) } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(req.body.currentPassword, user.password))) throw ApiError.badRequest('Your current password is incorrect', [{ field: 'currentPassword', message: 'Your current password is incorrect' }]);
  user.password = req.body.newPassword;
  await user.save(); // hashes the password and bumps tokenVersion: every other session is now signed out
  setAuthCookie(res, user); // this device stays signed in
  res.json({ success: true, message: 'Password updated' });
});
