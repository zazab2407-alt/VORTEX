import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-brand" />
    </div>
  );
}

/** Convenience only: the real protection is on the server. This just sends visitors to the right place. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container-x flex min-h-screen flex-col items-center justify-center text-center">
        <Logo />
        <p className="mt-10 font-display text-[7rem] font-extrabold leading-none text-brand">403</p>
        <h1 className="text-4xl font-extrabold">No access</h1>
        <p className="mt-2 max-w-md text-neutral-500">This area is only for store administrators.</p>
        <div className="mt-8 flex gap-3"><Link to="/" className="btn btn-primary">Back to store</Link><Link to="/account" className="btn btn-outline">My account</Link></div>
      </div>
    );
  }
  return <>{children}</>;
}
