import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/http';
import { safeNext } from '../utils/safeNext';
import Field from '../components/Field';

export default function Register() {
  useDocumentTitle('Create account');
  const { user, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const next = safeNext(useSearchParams()[0].get('next'));
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (user) return <Navigate to={next ?? '/account'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (form.name.trim().length < 2) local.name = 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = 'Please enter a valid email address';
    if (form.password.length < 8) local.password = 'Password must be at least 8 characters';
    if (form.confirm !== form.password) local.confirm = 'Passwords do not match';
    setErrors(local); setFormError(null);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const u = await register(form.name.trim(), form.email.trim(), form.password);
      toast(`Welcome to VORTEX, ${u.name.split(' ')[0]}!`);
      navigate(next ?? '/account', { replace: true });
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message])));
      else if (err instanceof ApiClientError && err.status === 409) setErrors({ email: 'An account with this email already exists. Try logging in instead.' });
      else setFormError((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="container-x flex justify-center py-12 lg:py-20">
      <div className="w-full max-w-md">
        <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">Join the pack</p>
        <h1 className="mb-8 text-5xl font-extrabold">Create account</h1>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {formError && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Field label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters" />
          <Field label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-600">Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand underline underline-offset-4">Log in</Link></p>
      </div>
    </div>
  );
}
