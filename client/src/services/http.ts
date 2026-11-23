import type { PageMeta } from '../types';

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api').replace(/\/$/, '');
// The login cookie is sent automatically; cross-origin deployments (VITE_API_URL on another domain) must opt in
const CREDENTIALS: RequestCredentials = BASE.startsWith('http') ? 'include' : 'same-origin';

/** Every failure (offline, timeout, server error, validation) becomes one of these, with a message safe to show. */
export class ApiClientError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface Options { params?: Record<string, string | number | boolean | undefined>; body?: unknown; signal?: AbortSignal; timeoutMs?: number }
export interface ApiResult<T> { data: T; meta?: PageMeta }

let onUnauthorized: (() => void) | null = null;
/** Called when a (non-login) request comes back 401, i.e. the session expired or was ended elsewhere. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

async function request<T>(method: Method, path: string, { params, body, signal, timeoutMs = 15000 }: Options = {}): Promise<ApiResult<T>> {
  const qs = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ''}`;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'vortex-web' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  try {
    const res = await fetch(url, { method, headers, body: payload, signal: timeout.signal, credentials: CREDENTIALS });
    let json: { success?: boolean; data?: T; meta?: PageMeta; message?: string; errors?: { field: string; message: string }[] } | null = null;
    try { json = await res.json(); } catch { /* not JSON, e.g. a proxy error page */ }

    if (!res.ok || !json || json.success === false) {
      if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
      const generic = res.status >= 500 || !json ? 'Our server is not responding right now. Please try again in a moment.' : 'Something went wrong.';
      throw new ApiClientError(json?.message ?? generic, res.status, json?.errors);
    }
    return { data: json.data as T, meta: json.meta };
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    if (signal?.aborted) throw err; // caller cancelled on purpose (e.g. navigated away); not an error to display
    if (timeout.signal.aborted) throw new ApiClientError('The server is taking too long to respond. Please try again.', 0);
    throw new ApiClientError('We could not reach the server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const apiGet = <T,>(path: string, options?: Options) => request<T>('GET', path, options);
export const apiSend = <T,>(method: Exclude<Method, 'GET'>, path: string, body?: unknown, options?: Omit<Options, 'body'>) => request<T>(method, path, { ...options, body });
