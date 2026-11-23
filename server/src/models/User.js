import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export const ROLES = ['customer', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: [2, 'Name is too short'], maxlength: 80 },
    email: {
      type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: { type: String, required: [true, 'Password is required'], minlength: [8, 'Password must be at least 8 characters'], select: false },
    role: { type: String, enum: { values: ROLES, message: 'Invalid role' }, default: 'customer' },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },
    /** Bumped on password change; tokens carry it, so every older session stops working immediately. */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, config.bcryptRounds);
  if (!this.isNew) this.tokenVersion += 1;
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; delete ret.tokenVersion; delete ret.__v; return ret; },
});

export default mongoose.model('User', userSchema);
