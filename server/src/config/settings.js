// Validates the business and infrastructure settings that come from environment variables.
// Pure (takes an env object, returns data) so it can be tested without touching process.env or the database.
// `errors` are fatal (the server refuses to start); `warnings` are printed once at startup.

const EMAIL = /^[^\s@"<>(),;:\\[\]]+@[^\s@"<>(),;:\\[\]]+\.[^\s@"<>(),;:\\[\]]+$/;
export const isPlainEmail = (s) => typeof s === 'string' && s.length <= 254 && EMAIL.test(s);

export function parseSettings(env = process.env) {
  const errors = [];
  const warnings = [];
  const str = (k) => String(env[k] ?? '').trim();
  const isProd = env.NODE_ENV === 'production';

  const number = (k, fallback, { min = 0, max = 1_000_000, int = false } = {}) => {
    const raw = str(k);
    if (raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
      errors.push(`${k} must be ${int ? 'a whole number' : 'a number'} between ${min} and ${max} (got "${raw}")`);
      return fallback;
    }
    return n;
  };
  const text = (k, max, fallback = null) => {
    const v = str(k);
    if (!v) return fallback;
    if (v.length > max) { errors.push(`${k} is too long (max ${max} characters)`); return fallback; }
    return v;
  };
  const email = (k) => {
    const v = str(k);
    if (!v) return null;
    if (!isPlainEmail(v)) { errors.push(`${k} must be a plain email address like shop@example.com`); return null; }
    return v.toLowerCase();
  };

  // Currency and formatting. Intl is the validator: if it accepts the pair, both the server and the browser can format it.
  let currency = str('CURRENCY').toUpperCase() || 'USD';
  let locale = str('CURRENCY_LOCALE') || 'en-US';
  try { locale = Intl.getCanonicalLocales(locale)[0]; } catch { errors.push(`CURRENCY_LOCALE "${locale}" is not a valid locale (try en-US or ar-EG)`); locale = 'en-US'; }
  let currencySymbol = '$';
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
    currencySymbol = parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch { errors.push(`CURRENCY "${currency}" is not a valid ISO 4217 currency code (like USD or EGP)`); currency = 'USD'; }

  const settings = {
    store: { name: text('STORE_NAME', 60, 'VORTEX'), currency, currencySymbol, locale },
    shipping: { flatRate: number('SHIPPING_FLAT_RATE', 5), freeThreshold: number('FREE_SHIPPING_THRESHOLD', 100) },
    contact: { email: email('STORE_EMAIL'), phone: text('STORE_PHONE', 30), address: text('STORE_ADDRESS', 200), to: email('CONTACT_TO') },
    returns: { windowDays: number('RETURN_WINDOW_DAYS', null, { min: 1, max: 365, int: true }) },
    promoCode: null,
    mongo: {
      transactions: str('MONGO_TRANSACTIONS').toLowerCase() || 'auto',
      maxPoolSize: number('MONGO_MAX_POOL_SIZE', 10, { min: 1, max: 100, int: true }),
    },
    smtp: { port: number('SMTP_PORT', 587, { min: 1, max: 65535, int: true }), problems: [] },
  };

  const promo = str('PROMO_CODE').toUpperCase();
  if (promo) {
    if (/^[A-Z0-9_-]{3,30}$/.test(promo)) settings.promoCode = promo;
    else errors.push('PROMO_CODE may only contain letters, numbers, - and _ (3 to 30 characters)');
  } else if (!isProd && !('PROMO_CODE' in env)) settings.promoCode = 'VORTEX10'; // the demo coupon created by `npm run seed`

  if (!['auto', 'off'].includes(settings.mongo.transactions)) {
    errors.push('MONGO_TRANSACTIONS must be "auto" or "off"');
    settings.mongo.transactions = 'auto';
  }

  // SMTP: all-or-nothing. A half-filled configuration silently disables email, so say so.
  const smtpKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const smtpSet = smtpKeys.filter((k) => str(k));
  if (smtpSet.length && smtpSet.length < smtpKeys.length) {
    const missing = smtpKeys.filter((k) => !str(k));
    settings.smtp.problems.push(`SMTP is only partly configured (missing ${missing.join(', ')}), so email is disabled`);
  }
  if (smtpSet.length === smtpKeys.length) {
    const from = str('MAIL_FROM');
    if (!from) settings.smtp.problems.push('MAIL_FROM is not set; mail will be sent from the placeholder address no-reply@vortex.com, which most providers reject');
    if (settings.contact.to === null && !str('CONTACT_TO')) warnings.push('CONTACT_TO is not set, so the contact form stays disabled even though SMTP is configured');
  }
  warnings.push(...settings.smtp.problems);

  return { settings, errors, warnings };
}
