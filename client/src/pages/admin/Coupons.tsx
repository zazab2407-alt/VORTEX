import { useEffect, useState, type FormEvent } from 'react';
import { Ban, CheckCircle2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { adminService, type CouponInput } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { ApiClientError } from '../../services/http';
import { formatPrice } from '../../utils/format';
import type { AdminCoupon, CouponState } from '../../types';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import Field from '../../components/Field';

const STATE_LABEL: Record<CouponState, string> = { active: 'Active', inactive: 'Inactive', expired: 'Expired', exhausted: 'Used up' };
const STATE_STYLE: Record<CouponState, string> = { active: 'bg-green-100 text-green-800', inactive: 'bg-neutral-200 text-neutral-700', expired: 'bg-amber-100 text-amber-800', exhausted: 'bg-neutral-200 text-neutral-700' };
const CODE_RULE = /^[A-Za-z0-9_-]{3,30}$/;

/** Form state keeps every field as text so partly typed values are never lost. */
interface Draft {
  id?: string; locked: boolean; usedCount: number; origExpiry: string;
  code: string; type: 'percentage' | 'fixed'; value: string; minSubtotal: string; expiresAt: string; usageLimit: string; isActive: boolean;
}
const blank: Draft = { locked: false, usedCount: 0, origExpiry: '', code: '', type: 'percentage', value: '', minSubtotal: '', expiresAt: '', usageLimit: '', isActive: true };

const fromCoupon = (c: AdminCoupon): Draft => ({
  id: c.id, locked: !c.canDelete, usedCount: c.usedCount, origExpiry: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
  code: c.code, type: c.type, value: String(c.value), minSubtotal: c.minSubtotal ? String(c.minSubtotal) : '',
  expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '', usageLimit: c.usageLimit != null ? String(c.usageLimit) : '', isActive: c.isActive,
});

/** Mirrors couponValidators.js and models/Coupon.js. The server re-checks everything; these messages only help the admin. */
function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!CODE_RULE.test(d.code.trim())) e.code = 'Code must be 3 to 30 letters, numbers, - or _';
  const v = Number(d.value);
  if (d.value.trim() === '' || !Number.isFinite(v)) e.value = 'Enter the discount value';
  else if (d.type === 'percentage' && (v < 1 || v > 100)) e.value = 'A percentage must be between 1 and 100';
  else if (d.type === 'fixed' && (v < 0.01 || v > 100000)) e.value = 'A fixed discount must be between 0.01 and 100,000';
  if (d.minSubtotal.trim() !== '') {
    const m = Number(d.minSubtotal);
    if (!Number.isFinite(m) || m < 0 || m > 1000000) e.minSubtotal = 'Enter a minimum order of 0 or more';
  }
  if (d.expiresAt) {
    const end = new Date(`${d.expiresAt}T23:59:59.999Z`);
    if (Number.isNaN(+end)) e.expiresAt = 'Enter a valid date';
    else if (d.expiresAt !== d.origExpiry && end < new Date()) e.expiresAt = 'The expiry date must be today or later';
  }
  if (d.usageLimit.trim() !== '') {
    const u = Number(d.usageLimit);
    if (!Number.isInteger(u) || u < 1 || u > 1000000) e.usageLimit = 'Enter a whole number of 1 or more';
    else if (d.id && u < d.usedCount) e.usageLimit = `Cannot be lower than ${d.usedCount} (already used)`;
  }
  return e;
}

const discountText = (c: AdminCoupon) => (c.type === 'percentage' ? `${c.value}% off` : `${formatPrice(c.value)} off`);
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No expiry');

export default function Coupons() {
  useDocumentTitle('Admin: coupons');
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CouponState | ''>('');
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(t); }, [text]);

  const { data, loading, error, reload } = useAsync((s) => adminService.coupons({ q: q || undefined, status }, s), [q, status]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminCoupon | null>(null);

  const open = (c?: AdminCoupon) => { setErrors({}); setFormError(null); setDraft(c ? fromCoupon(c) : blank); };
  const set = (patch: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setErrors({}); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const found = validate(draft);
    setErrors(found); setFormError(null);
    if (Object.keys(found).length) return;

    const payload: CouponInput = {
      type: draft.type, value: Number(draft.value), minSubtotal: draft.minSubtotal.trim() ? Number(draft.minSubtotal) : 0,
      expiresAt: draft.expiresAt || null, usageLimit: draft.usageLimit.trim() ? Number(draft.usageLimit) : null, isActive: draft.isActive,
    };
    if (!draft.locked) payload.code = draft.code.trim().toUpperCase(); // a used coupon keeps its code (the server refuses a change)

    setBusy(true);
    try {
      if (draft.id) await adminService.updateCoupon(draft.id, payload);
      else await adminService.createCoupon({ ...payload, code: draft.code.trim().toUpperCase() });
      toast(draft.id ? 'Coupon saved' : 'Coupon created');
      setDraft(null);
      reload();
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message])));
      else if (err instanceof ApiClientError && err.status === 409 && /code/i.test(err.message)) {
        // Duplicate code, or a used coupon whose code cannot change: show the message on the code field
        setErrors({ code: err.message.startsWith('That code') ? 'This code already exists' : err.message });
      }
      else setFormError((err as Error).message);
    } finally { setBusy(false); }
  };

  const setActive = async (c: AdminCoupon, isActive: boolean) => {
    setRowBusy(c.id);
    try {
      await adminService.updateCoupon(c.id, { isActive });
      toast(isActive ? `${c.code} activated` : `${c.code} deactivated`);
      reload();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setRowBusy(null); }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminService.deleteCoupon(toDelete.id);
      toast(`${toDelete.code} deleted`);
      setToDelete(null);
      reload();
    } catch (err) { toast((err as Error).message, 'error'); setToDelete(null); }
    finally { setBusy(false); }
  };

  const filtered = !!(q || status);
  const locked = !!draft?.locked;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-extrabold">Coupons</h1>
        <button className="btn btn-primary !px-5 !py-3" onClick={() => open()}><Plus size={18} /> Add coupon</button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by code" aria-label="Search coupons" maxLength={30} className="input bg-white pl-10" />
        </div>
        <select aria-label="Filter by status" className="input bg-white" value={status} onChange={(e) => setStatus(e.target.value as CouponState | '')}>
          <option value="">All statuses</option>
          {(Object.keys(STATE_LABEL) as CouponState[]).map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
        </select>
        {filtered && <button className="btn btn-outline !px-4 !py-2.5" onClick={() => { setText(''); setStatus(''); }}>Clear</button>}
      </div>

      {draft && (
        <form onSubmit={save} className="mb-6 space-y-4 bg-white p-5" noValidate aria-label={draft.id ? 'Edit coupon' : 'New coupon'}>
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-extrabold">{draft.id ? 'Edit coupon' : 'New coupon'}</h2>
            <button type="button" aria-label="Close form" onClick={() => setDraft(null)}><X size={22} /></button>
          </div>
          {formError && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          {locked && <p className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">This coupon has been used on {draft.usedCount} {draft.usedCount === 1 ? 'order' : 'orders'}, so its code cannot change. You can still change its rules or deactivate it.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code" value={draft.code} onChange={(e) => set({ code: e.target.value })} error={errors.code} maxLength={30} disabled={locked} hint="3 to 30 letters, numbers, - or _. Shoppers type it at checkout." autoFocus={!draft.id} />
            <div>
              <label htmlFor="coupon-type" className="mb-1.5 block text-sm font-semibold">Type</label>
              <select id="coupon-type" className="input" value={draft.type} onChange={(e) => set({ type: e.target.value as Draft['type'] })}>
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            <Field label={draft.type === 'percentage' ? 'Discount (%)' : 'Discount amount'} type="number" inputMode="decimal" step="0.01" min="0" value={draft.value} onChange={(e) => set({ value: e.target.value })} error={errors.value} />
            <Field label="Minimum order (optional)" type="number" inputMode="decimal" step="0.01" min="0" value={draft.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} error={errors.minSubtotal} hint="Leave empty for no minimum." />
            <Field label="Expires on (optional)" type="date" value={draft.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} error={errors.expiresAt} hint="Valid through the end of this day. Leave empty for no expiry." />
            <Field label="Usage limit (optional)" type="number" inputMode="numeric" step="1" min="1" value={draft.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} error={errors.usageLimit} hint={draft.id ? `Used ${draft.usedCount} ${draft.usedCount === 1 ? 'time' : 'times'} so far. Leave empty for unlimited.` : 'Leave empty for unlimited.'} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Active (shoppers can use it)</label>
          <div className="flex gap-3">
            <button className="btn btn-dark !px-6 !py-3" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" className="btn btn-outline !px-6 !py-3" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      {error ? <ErrorState error={error} onRetry={reload} title="We could not load coupons" /> : (
        <div className="bg-white">
          {loading ? <div className="space-y-px">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-neutral-100" />)}</div>
            : !data?.length ? <p className="py-16 text-center text-neutral-500">{filtered ? 'No coupons match these filters.' : 'No coupons yet. Add one to offer a discount at checkout.'}</p>
            : (
              <ul className="divide-y divide-neutral-200">
                {data.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-mono font-semibold tracking-wide">{c.code}</p>
                      <p className="text-sm text-neutral-600">{discountText(c)}{c.minSubtotal > 0 && <> &middot; min {formatPrice(c.minSubtotal)}</>}</p>
                    </div>
                    <p className="w-40 text-sm text-neutral-600">{dateText(c.expiresAt)}<br /><span className="text-xs">{c.usageLimit != null ? `${c.usedCount} of ${c.usageLimit} used` : `${c.usedCount} used`}</span></p>
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${STATE_STYLE[c.state]}`}>{STATE_LABEL[c.state]}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button className="flex h-9 w-9 items-center justify-center border border-neutral-300 hover:border-neutral-950" aria-label={`Edit ${c.code}`} onClick={() => open(c)}><Pencil size={16} /></button>
                      {c.isActive
                        ? <button className="flex h-9 items-center gap-1.5 border border-neutral-300 px-3 text-sm hover:border-neutral-950 disabled:opacity-40" disabled={rowBusy === c.id} onClick={() => setActive(c, false)}><Ban size={15} /> Deactivate</button>
                        : <button className="flex h-9 items-center gap-1.5 border border-neutral-300 px-3 text-sm hover:border-neutral-950 disabled:opacity-40" disabled={rowBusy === c.id} onClick={() => setActive(c, true)}><CheckCircle2 size={15} /> Activate</button>}
                      {c.canDelete
                        ? <button className="flex h-9 w-9 items-center justify-center border border-neutral-300 hover:border-red-600 hover:text-red-600" aria-label={`Delete ${c.code}`} onClick={() => setToDelete(c)}><Trash2 size={16} /></button>
                        : <span className="flex h-9 items-center px-2 text-xs text-neutral-500">{c.orderCount > 0 ? `Used on ${c.orderCount} ${c.orderCount === 1 ? 'order' : 'orders'}` : `Used ${c.usedCount} ${c.usedCount === 1 ? 'time' : 'times'}`}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      <ConfirmDialog open={!!toDelete} title="Delete coupon?" message={`"${toDelete?.code}" will be permanently deleted. You can deactivate it instead to keep it on record.`} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}
