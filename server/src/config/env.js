import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseSettings } from './settings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !env[k]);
if (missing.length) {
  console.error(`\nMissing required environment variable(s): ${missing.join(', ')}\nCopy server/.env.example to server/.env and fill them in.\n`);
  process.exit(1);
}
if (env.JWT_SECRET.length < 32 || /change-this/i.test(env.JWT_SECRET)) {
  const msg = 'JWT_SECRET must be a random string of at least 32 characters.';
  if (isProd) { console.error(`\n${msg}\n`); process.exit(1); }
  console.warn(`[config] Warning: ${msg} (allowed in development only)`);
}

const { settings, errors, warnings } = parseSettings(env);
if (errors.length) {
  console.error(`\nInvalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}\nFix server/.env (see server/.env.example) and start again.\n`);
  process.exit(1);
}
for (const w of warnings) console.warn(`[config] Warning: ${w}`);

const num = (v, fallback) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : fallback);

const sameSiteNone = (env.COOKIE_SAMESITE || '').toLowerCase() === 'none';
if (sameSiteNone && !isProd) console.warn('[config] COOKIE_SAMESITE=none needs HTTPS (Secure cookies); it will only work in production.');

// Without NODE_ENV=production cookies are not Secure, error responses include stack traces and weak secrets are tolerated.
const looksHosted = /^mongodb\+srv:/.test(env.MONGO_URI) || (env.CLIENT_URL || '').split(',').some((u) => /^https:\/\/(?!localhost|127\.)/i.test(u.trim()));
if (!isProd && looksHosted && env.NODE_ENV !== 'test') console.warn('[config] Warning: this looks like a hosted setup (Atlas URI or https CLIENT_URL) but NODE_ENV is not "production". Set NODE_ENV=production on the server.');

export const config = Object.freeze({
  env: env.NODE_ENV || 'development',
  isProd,
  port: num(env.PORT, 5000),
  mongoUri: env.MONGO_URI,
  mongo: settings.mongo,
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN || '7d' },
  cookie: {
    name: 'vortex_token',
    secure: isProd,
    sameSite: ['lax', 'strict', 'none'].includes((env.COOKIE_SAMESITE || '').toLowerCase()) ? env.COOKIE_SAMESITE.toLowerCase() : 'lax',
  },
  bcryptRounds: 12,
  clientUrls: (env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  uploadsDir: env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : path.join(root, 'uploads'), // point at a persistent disk in production
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    enabled: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },
  smtp: {
    host: env.SMTP_HOST, port: settings.smtp.port, user: env.SMTP_USER, pass: env.SMTP_PASS,
    from: env.MAIL_FROM || 'VORTEX <no-reply@vortex.com>',
    enabled: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  },
  shipping: settings.shipping,
  store: settings.store,
  contact: settings.contact,
  returns: settings.returns,
  promoCode: settings.promoCode,
});
