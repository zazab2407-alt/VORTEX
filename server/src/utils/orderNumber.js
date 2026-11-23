import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion when read aloud

/** e.g. VTX-261111-K7QF3MXA  (date + 8 random chars = ~1 trillion combinations per day). Uniqueness is enforced by a DB index; callers retry on collision. */
export function generateOrderNumber(date = new Date()) {
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  const bytes = crypto.randomBytes(8);
  let suffix = '';
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `VTX-${d}-${suffix}`;
}
