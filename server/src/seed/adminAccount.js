// Core of the create-admin script: create an admin, promote a customer, or reset an existing account's password.
// Kept free of prompts and console output so it can be tested. It never logs, prints or returns a password (or its hash).
// Passwords are always set through the User model, so its pre('save') hook does the bcrypt hashing and bumps tokenVersion.

export const MIN_ADMIN_PASSWORD = 10;
export const MAX_PASSWORD_BYTES = 72; // bcrypt only uses the first 72 BYTES, so longer passwords are refused rather than truncated

export function assertValidAdminPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD) throw new Error(`Admin password must be at least ${MIN_ADMIN_PASSWORD} characters`);
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) throw new Error(`Password is too long (max ${MAX_PASSWORD_BYTES} bytes)`);
}

/**
 * @param {import('mongoose').Model} User
 * @returns {Promise<{ action: 'created' | 'promoted' | 'unchanged' | 'password-reset', passwordReset: boolean, inactive: boolean }>}
 */
export async function applyAdmin(User, { email, name = 'Store Admin', password, resetPassword = false }) {
  const existing = await User.findOne({ email });

  if (!existing) {
    assertValidAdminPassword(password);
    await User.create({ name, email, password, role: 'admin' });
    return { action: 'created', passwordReset: false, inactive: false };
  }

  const isAdmin = existing.role === 'admin';
  if (isAdmin && !resetPassword) return { action: 'unchanged', passwordReset: false, inactive: !existing.isActive };

  if (resetPassword) assertValidAdminPassword(password); // validate before touching anything
  if (!isAdmin) { existing.role = 'admin'; existing.isActive = true; }
  if (resetPassword) existing.password = password; // hashed + tokenVersion incremented by the model's pre('save') hook
  await existing.save();
  return { action: isAdmin ? 'password-reset' : 'promoted', passwordReset: resetPassword, inactive: !existing.isActive };
}
