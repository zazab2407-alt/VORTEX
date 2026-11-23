import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ImagePlus, Star, X } from 'lucide-react';
import { adminService, type ProductInput } from '../../services/admin';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { ApiClientError } from '../../services/http';
import { ALL_SIZES, FILTER_COLORS } from '../../data/catalog';
import { variantKey } from '../../utils/format';
import type { ColorOption, Gender } from '../../types';
import Field from '../../components/Field';
import ErrorState from '../../components/ErrorState';
import Img from '../../components/Img';

interface FormState {
  name: string; description: string; price: string; salePrice: string; category: string; gender: Gender;
  sizes: string[]; colors: ColorOption[]; stock: Record<string, string>; images: string[]; isFeatured: boolean; isActive: boolean;
}
const EMPTY: FormState = { name: '', description: '', price: '', salePrice: '', category: '', gender: 'men', sizes: [], colors: [], stock: {}, images: [], isFeatured: false, isActive: true };
const MAX_IMAGES = 10;

const Section = ({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) => (
  <section className="bg-white p-5 sm:p-6">
    <h2 className="text-3xl font-extrabold">{title}</h2>
    {hint && <p className="mb-4 mt-0.5 text-sm text-neutral-500">{hint}</p>}
    <div className={hint ? '' : 'mt-4'}>{children}</div>
  </section>
);
const chip = (on: boolean) => `border px-3.5 py-2 text-sm font-medium transition-colors ${on ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white hover:border-neutral-950'}`;

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  useDocumentTitle(isNew ? 'Admin: new product' : 'Admin: edit product');
  const navigate = useNavigate();
  const { toast } = useToast();

  const cats = useAsync((s) => adminService.categories(s), []);
  const product = useAsync(async (s) => (id ? adminService.product(id, s) : null), [id]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [customSize, setCustomSize] = useState('');
  const [customColor, setCustomColor] = useState({ name: '', hex: '#ff5a1f' });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = product.data;
    if (!p) return;
    setForm({
      name: p.name, description: p.description, price: String(p.price), salePrice: p.salePrice != null ? String(p.salePrice) : '', category: p.categoryId ?? '', gender: p.gender,
      sizes: p.sizes, colors: p.colors, stock: Object.fromEntries(Object.entries(p.stock).map(([k, v]) => [k, String(v)])), images: p.images, isFeatured: !!p.isFeatured, isActive: p.isActive !== false,
    });
    setOriginal(p.stock);
  }, [product.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSize = (s: string) => set('sizes', form.sizes.includes(s) ? form.sizes.filter((x) => x !== s) : [...form.sizes, s]);
  const toggleColor = (c: ColorOption) => set('colors', form.colors.some((x) => x.name === c.name) ? form.colors.filter((x) => x.name !== c.name) : [...form.colors, c]);
  const addSize = () => {
    const s = customSize.trim();
    if (!s) return;
    if (s.length > 12) return toast('Sizes can be at most 12 characters', 'error');
    if (!form.sizes.includes(s)) set('sizes', [...form.sizes, s]);
    setCustomSize('');
  };
  const addColor = () => {
    const name = customColor.name.trim();
    if (!name) return toast('Give the colour a name', 'error');
    if (!form.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) set('colors', [...form.colors, { name, hex: customColor.hex }]);
    setCustomColor({ name: '', hex: customColor.hex });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    let count = form.images.length;
    for (const file of Array.from(files)) {
      if (count >= MAX_IMAGES) { toast(`A product can have at most ${MAX_IMAGES} images`, 'error'); break; }
      count += 1; setUploading((n) => n + 1);
      try { const { url } = await adminService.uploadImage(file); setForm((f) => ({ ...f, images: [...f.images, url] })); setErrors((e) => ({ ...e, images: '' })); }
      catch (err) { count -= 1; toast(`${file.name}: ${(err as Error).message}`, 'error'); }
      finally { setUploading((n) => n - 1); }
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const price = Number(form.price); const sale = form.salePrice.trim() === '' ? null : Number(form.salePrice);
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (form.description.trim().length < 10) e.description = 'Description must be at least 10 characters';
    if (form.price.trim() === '' || Number.isNaN(price) || price < 0) e.price = 'Enter a valid price';
    if (sale !== null && (Number.isNaN(sale) || sale < 0 || sale >= price)) e.salePrice = 'Sale price must be lower than the regular price';
    if (!form.category) e.category = 'Choose a category';
    if (!form.sizes.length) e.sizes = 'Choose at least one size';
    if (!form.colors.length) e.colors = 'Choose at least one colour';
    if (!form.images.length) e.images = 'Add at least one image';
    return e;
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please fix the highlighted fields', 'error'); return; }
    setBusy(true);
    const stockOf = (s: string, c: string) => Math.max(0, Math.floor(Number(form.stock[variantKey(s, c)] ?? 0)) || 0);
    const base: Omit<ProductInput, 'salePrice' | 'variants'> = {
      name: form.name.trim(), description: form.description.trim(), price: Number(form.price), images: form.images, category: form.category,
      gender: form.gender, sizes: form.sizes, colors: form.colors, isFeatured: form.isFeatured, isActive: form.isActive,
    };
    try {
      if (isNew) {
        const variants = form.sizes.flatMap((size) => form.colors.map((c) => ({ size, color: c.name, stock: stockOf(size, c.name) })));
        await adminService.createProduct({ ...base, salePrice: form.salePrice.trim() === '' ? undefined : Number(form.salePrice), variants });
        toast('Product created');
      } else {
        await adminService.updateProduct(id!, { ...base, salePrice: form.salePrice.trim() === '' ? null : Number(form.salePrice) });
        // Stock is changed per variant, atomically, so edits never overwrite sales that happened meanwhile
        for (const size of form.sizes) for (const c of form.colors) {
          const want = stockOf(size, c.name);
          if (want !== (original[variantKey(size, c.name)] ?? 0)) await adminService.setStock(id!, size, c.name, want);
        }
        toast('Product saved');
      }
      navigate('/admin/products');
    } catch (err) {
      const fe = err instanceof ApiClientError ? err.fieldErrors : undefined;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field.split('.')[0], x.message])));
      toast((err as Error).message, 'error');
    } finally { setBusy(false); }
  };

  if (!isNew && product.loading) return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse bg-white" />)}</div>;
  if (!isNew && product.error) return <ErrorState error={product.error} onRetry={product.reload} title="We could not load this product" />;
  if (!isNew && !product.data) return <p className="py-20 text-center text-neutral-500">Product not found. <Link to="/admin/products" className="font-semibold text-brand underline">Back to products</Link></p>;

  return (
    <form onSubmit={save} noValidate className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/products" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-brand"><ArrowLeft size={16} /> Products</Link>
          <h1 className="text-5xl font-extrabold">{isNew ? 'New product' : 'Edit product'}</h1>
        </div>
        {!isNew && product.data && product.data.isActive !== false && <Link to={`/product/${product.data.slug}`} target="_blank" className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-brand">View in store <ExternalLink size={15} /></Link>}
      </div>

      <Section title="Details">
        <div className="space-y-4">
          <Field label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={120} />
          <Field multiline label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} rows={4} maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price ($)" type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
            <Field label="Sale price ($, optional)" type="number" min="0" step="0.01" inputMode="decimal" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} error={errors.salePrice} hint="Leave empty for no sale." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-semibold">Category</label>
              <select id="category" className={`input ${errors.category ? '!border-red-500' : ''}`} value={form.category} onChange={(e) => set('category', e.target.value)} aria-invalid={!!errors.category}>
                <option value="">Choose a category...</option>
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive === false ? ' (hidden)' : ''}</option>)}
              </select>
              {errors.category && <p role="alert" className="mt-1 text-sm text-red-600">{errors.category}</p>}
            </div>
            <div>
              <label htmlFor="gender" className="mb-1.5 block text-sm font-semibold">Gender</label>
              <select id="gender" className="input" value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                <option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in the store</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Feature in Best Sellers</label>
          </div>
        </div>
      </Section>

      <Section title="Images" hint={`Up to ${MAX_IMAGES} photos (JPEG, PNG or WebP, max 5 MB each). The first image is the cover.`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {form.images.map((url, i) => (
            <div key={url} className="group relative aspect-[4/5] bg-neutral-100">
              <Img src={url} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Cover</span>}
              <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => set('images', form.images.filter((u) => u !== url))} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center bg-neutral-950/80 text-white hover:bg-red-600"><X size={14} /></button>
              {i > 0 && <button type="button" aria-label={`Make image ${i + 1} the cover`} onClick={() => set('images', [url, ...form.images.filter((u) => u !== url)])} className="absolute bottom-1.5 left-1.5 flex h-7 items-center gap-1 bg-white/90 px-2 text-[11px] font-semibold hover:bg-white"><Star size={12} /> Cover</button>}
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => <div key={`u${i}`} className="flex aspect-[4/5] animate-pulse items-center justify-center bg-neutral-100 text-xs text-neutral-400">Uploading...</div>)}
          {form.images.length + uploading < MAX_IMAGES && (
            <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-neutral-300 text-sm text-neutral-500 transition-colors focus-within:border-brand hover:border-brand hover:text-brand">
              <ImagePlus size={26} /> Add images
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Upload product images" />
            </label>
          )}
        </div>
        {errors.images && <p role="alert" className="mt-2 text-sm text-red-600">{errors.images}</p>}
      </Section>

      <Section title="Sizes & colours">
        <h3 className="mb-2 text-sm font-semibold">Sizes</h3>
        <div className="flex flex-wrap gap-2">
          {[...ALL_SIZES, ...form.sizes.filter((s) => !ALL_SIZES.includes(s))].map((s) => <button type="button" key={s} aria-pressed={form.sizes.includes(s)} onClick={() => toggleSize(s)} className={chip(form.sizes.includes(s))}>{s}</button>)}
        </div>
        <div className="mt-3 flex max-w-xs gap-2"><input className="input" placeholder="Custom size" aria-label="Custom size" value={customSize} maxLength={12} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }} /><button type="button" className="btn btn-outline !px-4 !py-2.5" onClick={addSize}>Add</button></div>
        {errors.sizes && <p role="alert" className="mt-2 text-sm text-red-600">{errors.sizes}</p>}

        <h3 className="mb-2 mt-6 text-sm font-semibold">Colours</h3>
        <div className="flex flex-wrap gap-2">
          {[...FILTER_COLORS, ...form.colors.filter((c) => !FILTER_COLORS.some((p) => p.name === c.name))].map((c) => {
            const on = form.colors.some((x) => x.name === c.name);
            return <button type="button" key={c.name} aria-pressed={on} onClick={() => toggleColor(c)} className={`flex items-center gap-2 ${chip(on)}`}><span className="h-4 w-4 rounded-full border border-black/20" style={{ background: c.hex }} />{c.name}</button>;
          })}
        </div>
        <div className="mt-3 flex max-w-sm items-center gap-2">
          <input className="input" placeholder="Custom colour name" aria-label="Custom colour name" value={customColor.name} maxLength={30} onChange={(e) => setCustomColor({ ...customColor, name: e.target.value })} />
          <input type="color" aria-label="Custom colour value" value={customColor.hex} onChange={(e) => setCustomColor({ ...customColor, hex: e.target.value })} className="h-11 w-12 shrink-0 cursor-pointer border border-neutral-300 bg-white p-1" />
          <button type="button" className="btn btn-outline !px-4 !py-2.5" onClick={addColor}>Add</button>
        </div>
        {errors.colors && <p role="alert" className="mt-2 text-sm text-red-600">{errors.colors}</p>}
      </Section>

      <Section title="Stock" hint="Units available for every size and colour. Customers cannot order more than this.">
        {!form.sizes.length || !form.colors.length ? <p className="text-sm text-neutral-500">Choose at least one size and one colour to set stock.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead><tr><th className="py-2 pr-4 text-left font-semibold">Size</th>{form.colors.map((c) => <th key={c.name} className="px-2 py-2 text-left font-semibold"><span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/20 align-middle" style={{ background: c.hex }} />{c.name}</th>)}</tr></thead>
              <tbody>
                {form.sizes.map((s) => (
                  <tr key={s} className="border-t border-neutral-200">
                    <th scope="row" className="py-2 pr-4 text-left font-semibold">{s}</th>
                    {form.colors.map((c) => (
                      <td key={c.name} className="p-1.5">
                        <input type="number" min="0" step="1" inputMode="numeric" aria-label={`Stock for ${s} ${c.name}`} className="input !w-24 !px-3 !py-2" value={form.stock[variantKey(s, c.name)] ?? ''} placeholder="0"
                          onChange={(e) => setForm((f) => ({ ...f, stock: { ...f.stock, [variantKey(s, c.name)]: e.target.value } }))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-neutral-200 bg-neutral-100/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <button className="btn btn-primary !px-8 !py-3" disabled={busy || uploading > 0}>{busy ? 'Saving...' : isNew ? 'Create product' : 'Save changes'}</button>
        <Link to="/admin/products" className="btn btn-outline !px-6 !py-3">Cancel</Link>
      </div>
    </form>
  );
}
