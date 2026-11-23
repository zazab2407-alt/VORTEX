import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/auth';
import { setUnauthorizedHandler } from '../services/http';

interface AuthCtx {
  user: User | null;
  /** true only while we find out whether a login cookie exists (first page load). */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Asks the server who is signed in and updates the page to match. Sends no logout request. */
  refreshSession: () => Promise<void>;
  setUser: (u: User) => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    authService.me(ctrl.signal).then(setUserState).catch(() => { /* offline: treat as logged out */ }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  // Any API call answered with 401 means the session ended (expired, password changed elsewhere, account disabled)
  useEffect(() => { setUnauthorizedHandler(() => setUserState(null)); return () => setUnauthorizedHandler(null); }, []);

  const login = useCallback(async (e: string, p: string) => { const u = await authService.login(e, p); setUserState(u); return u; }, []);
  const register = useCallback(async (n: string, e: string, p: string) => { const u = await authService.register(n, e, p); setUserState(u); return u; }, []);
  const logout = useCallback(async () => { await authService.logout().catch(() => {}); setUserState(null); }, []);
  // Reads the session from the server, so the page always matches the cookie the server actually sent. A failed call keeps what we know.
  const refreshSession = useCallback(async () => { try { setUserState(await authService.me()); } catch { /* offline: keep the current state */ } }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshSession, setUser: setUserState }), [user, loading, login, register, logout, refreshSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
};
