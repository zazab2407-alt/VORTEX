import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { authService } from '../services/auth';
import { ApiClientError } from '../services/http';
import { formatPrice } from '../utils/format';
import Field from '../components/Field';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

type Tab = 'profile' | 'orders' | 'password';
const TABS: { id: Tab; label: string }[] = [{ id: 'profile', label: 'Profile' }, { id: 'orders', label: 'My orders' }, { id: 'password', label: 'Password' }];

function ProfileTab() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: user!.name, phone: user!.phone, address: user!.address, city: user!.city });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErrors({}); setBusy(true);
    try { setUser(await authService.updateProfile(form)); toast('Profile saved'); }
    catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message]))); else toast((err as Error).message, 'error');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <Field label="Email" value={user!.email} disabled hint="Your email is your login and cannot be changed here." readOnly />
      <Field label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
      <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
      <Field label="Address" value={form.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
      <Field label="City" value={form.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
      <button className="btn btn-dark" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
    </form>
  );
}

function OrdersTab() {
  const { data, loading, error, reload } = useAsync((s) => authService.myOrders(s), []);
  if (error) return <ErrorState error={error} onRetry={reload} compact title="We could not load your orders" />;
  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse bg-neutral-100" />)}</div>;
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Package size={56} className="text-neutral-300" />
        <p className="mt-3 font-display text-2xl font-bold uppercase">No orders yet</p>
        <p className="mt-1 text-sm text-neutral-500">When you place an order it will show up here.</p>
        <Link to="/shop" className="btn btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {data.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Link to={`/orders/${o.orderNumber}`} className="font-semibold hover:text-brand">{o.orderNumber}</Link>
            <p className="text-sm text-neutral-500">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} &middot; {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</p>
          </div>
          <StatusBadge status={o.status} />
          <span className="font-bold">{formatPrice(o.total)}</span>
        </li>
      ))}
    </ul>
  );
}

function PasswordTab() {
  const { toast } = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.current) local.currentPassword = 'Enter your current password';
    if (form.next.length < 8) local.newPassword = 'New password must be at least 8 characters';
    if (form.confirm !== form.next) local.confirm = 'Passwords do not match';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await authService.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast('Password updated. Other devices have been signed out.');
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message]))); else setErrors({ currentPassword: (err as Error).message });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <Field label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} error={errors.currentPassword} />
      <Field label="New password" type="password" autoComplete="new-password" value={form.next} onChange={set('next')} error={errors.newPassword} hint="At least 8 characters. Changing it signs you out everywhere else." />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
      <button className="btn btn-dark" disabled={busy}>{busy ? 'Updating...' : 'Update password'}</button>
    </form>
  );
}

export default function Account() {
  useDocumentTitle('My account');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  if (!user) return null;

  return (
    <div className="container-x py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <p className="font-display text-lg font-bold uppercase tracking-[0.25em] text-brand">My account</p>
          <h1 className="text-5xl font-extrabold sm:text-6xl">Hi, {user.name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {user.role === 'admin' && <Link to="/admin" className="btn btn-primary !px-5 !py-3"><LayoutDashboard size={18} /> Admin dashboard</Link>}
          <button className="btn btn-outline !px-5 !py-3" onClick={async () => { await logout(); toast('You have been logged out'); navigate('/'); }}><LogOut size={18} /> Log out</button>
        </div>
      </div>
      <div role="tablist" aria-label="Account sections" className="mb-8 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border px-5 py-2.5 font-display text-lg font-bold uppercase tracking-wider transition-colors ${tab === t.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 hover:border-neutral-950'}`}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'password' && <PasswordTab />}
      </div>
    </div>
  );
}
