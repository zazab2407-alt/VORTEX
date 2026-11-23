/** Only same-site paths are allowed as a post-login destination (blocks open redirects like //evil.com). */
export const safeNext = (n: string | null): string | null => (n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : null);
