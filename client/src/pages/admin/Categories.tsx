import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { adminService } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { ApiClientError } from '../../services/http';
import type { Category } from '../../types';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import Field from '../../components/Field';

interface Draft { id?: string; name: string; description: string; image: string; isActive: boolean }
const blank: Draft = { name: '', description: '', image: '', isActive: true };

export default function Categories() {
  useDocumentTitle('Admin: categories');
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync((s) => adminService.categories(s), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const open = (c?: Category) => { setErrors({}); setDraft(c ? { id: c.id, name: c.name, description: c.description, image: c.image, isActive: c.isActive !== false } : blank); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (draft.name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setBusy(true); setErrors({});
    const body = { name: draft.name.trim(), description: draft.description.trim(), image: draft.image.trim(), isActive: draft.isActive };
    try {
      if (draft.id) await adminService.updateCategory(draft.id, body); else await adminService.createCategory(body);
      toast(draft.id ? 'Category saved' : 'Category created'); setDraft(null); reload();
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message])));
      else setErrors({ name: (err as Error).message });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try { await adminService.deleteCategory(toDelete.id); toast(`"${toDelete.name}" deleted`); setToDelete(null); reload(); }
    catch (err) { toast((err as Error).message, 'error'); setToDelete(null); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-extrabold">Categories</h1>
        <button className="btn btn-primary !px-5 !py-3" onClick={() => open()}><Plus size={18} /> Add category</button>
      </div>

      {draft && (
        <form onSubmit={save} className="mb-6 space-y-4 bg-white p-5" noValidate aria-label={draft.id ? 'Edit category' : 'New category'}>
          <div className="flex items-center justify-between"><h2 className="text-3xl font-extrabold">{draft.id ? 'Edit category' : 'New category'}</h2><button type="button" aria-label="Close form" onClick={() => setDraft(null)}><X size={22} /></button></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} error={errors.name} maxLength={60} autoFocus />
            <Field label="Image URL (optional)" value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} error={errors.image} placeholder="https://..." />
          </div>
          <Field multiline label="Description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} error={errors.description} rows={2} maxLength={500} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Visible in the store</label>
          <div className="flex gap-3"><button className="btn btn-dark !px-6 !py-3" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button><button type="button" className="btn btn-outline !px-6 !py-3" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}

      {error ? <ErrorState error={error} onRetry={reload} title="We could not load categories" /> : (
        <div className="bg-white">
          {loading ? <div className="space-y-px">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-neutral-100" />)}</div>
            : !data?.length ? <p className="py-16 text-center text-neutral-500">No categories yet.</p> : (
              <ul className="divide-y divide-neutral-200">
                {data.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1 basis-44"><p className="font-semibold">{c.name}</p><p className="truncate text-xs text-neutral-500">/{c.slug}</p></div>
                    <p className="w-24 text-sm text-neutral-600">{c.productCount} {c.productCount === 1 ? 'product' : 'products'}</p>
                    {c.isActive === false && <span className="bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">Hidden</span>}
                    <div className="flex gap-1.5">
                      <button className="flex h-9 w-9 items-center justify-center border border-neutral-300 hover:border-neutral-950" aria-label={`Edit ${c.name}`} onClick={() => open(c)}><Pencil size={16} /></button>
                      <button className="flex h-9 w-9 items-center justify-center border border-neutral-300 hover:border-red-600 hover:text-red-600" aria-label={`Delete ${c.name}`} onClick={() => setToDelete(c)}><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
      <ConfirmDialog open={!!toDelete} title="Delete category?" message={`"${toDelete?.name}" will be deleted. Categories that still contain products cannot be deleted.`} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}
