import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { safeNext } from '../utils/safeNext';
import Field from '../components/Field';

export default function Login() {
  useDocumentTitle('Log in');
  const { user, login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next ?? (user.role === 'admin' ? '/admin' : '/account')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const u = await login(email.trim(), password);
      toast(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate(next ?? (u.role === 'admin' ? '/admin' : '/account'), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="container-x flex justify-center py-12 lg:py-20">
      <div className="w-full max-w-md">
        <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Welcome back</p>
        <h1 className="mb-8 text-5xl font-extrabold">Log in</h1>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn btn-primary w-full" disabled={busy || !email || !password}>{busy ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-600">New to VORTEX? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand underline underline-offset-4">Create an account</Link></p>
      </div>
    </div>
  );
}
