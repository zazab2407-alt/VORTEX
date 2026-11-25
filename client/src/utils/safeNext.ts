const BASE = 'http://safe-next.invalid';

/**
 * Only same-site paths are allowed as a post-login destination (blocks open redirects like //evil.com).
 * Rejects: anything not starting with a single "/", backslashes (browsers treat "\" like "/"), and any whitespace or
 * control character (browsers silently delete tab/CR/LF while parsing, so "/<TAB>/evil.com" would become "//evil.com").
 * As a last check the path is resolved the way a browser would, and must stay on the same origin.
 */
export const safeNext = (n: string | null): string | null => {
  if (!n || !n.startsWith('/') || n.startsWith('//') || n.includes('\\') || /[\u0000-\u001f\u007f\s]/.test(n)) return null;
  try {
    return new URL(n, BASE).origin === BASE ? n : null;
  } catch {
    return null;
  }
};
