/** "7d" / "12h" / "30m" / "45s" -> milliseconds (falls back to 7 days). Used to match the cookie lifetime to the JWT lifetime. */
export function toMs(value, fallback = 7 * 864e5) {
  const m = /^(\d+)\s*([smhd])$/i.exec(String(value).trim());
  if (!m) return fallback;
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2].toLowerCase()];
}
