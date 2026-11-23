import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, Heart, RotateCcw, ShoppingBag, Truck } from 'lucide-react';
import { productService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { discountPercent, formatPrice, variantKey } from '../utils/format';
import { useShopConfig } from '../hooks/useShopConfig';
import { freeShippingLabel } from '../utils/storeText';
import Img from '../components/Img';
import Rating from '../components/Rating';
import QuantitySelector from '../components/QuantitySelector';
import ProductGrid from '../components/ProductGrid';
import SectionHeading from '../components/SectionHeading';
import ErrorState from '../components/ErrorState';
import NotFound from './NotFound';
import type { Product } from '../types';

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-neutral-200 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl font-bold uppercase tracking-wide">
        {title}<ChevronDown size={18} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-neutral-600">{children}</div>
    </details>
  );
}

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const shop = useShopConfig();
  const { data: product, loading, error, reload } = useAsync((s) => productService.bySlug(slug, s), [slug]);
  const { data: related, loading: relLoading, error: relError } = useAsync((s) => (product ? productService.related(product, 4, s) : Promise.resolve([] as Product[])), [product?.id]);
  const cart = useCart();
  const wishlist = useWishlist();
  const { toast } = useToast();

  const [img, setImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setImg(0); setColor(null); setQty(1); setAttempted(false);
    setSize(product && product.sizes.length === 1 ? product.sizes[0] : null);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useDocumentTitle(product?.name);

  const stock = useMemo(() => (product && size && color ? product.stock[variantKey(size, color)] ?? 0 : null), [product, size, color]);
  useEffect(() => { if (stock !== null && qty > Math.max(stock, 1)) setQty(Math.max(stock, 1)); }, [stock, qty]);

  if (loading) return <div className="container-x grid animate-pulse gap-10 py-10 lg:grid-cols-2"><div className="aspect-[4/5] bg-neutral-200" /><div className="space-y-4"><div className="h-10 w-2/3 bg-neutral-200" /><div className="h-6 w-1/4 bg-neutral-200" /><div className="h-40 bg-neutral-200" /></div></div>;
  if (error) return <div className="container-x"><ErrorState error={error} onRetry={reload} /></div>;
  if (!product) return <NotFound />;

  const p = product;
  const off = discountPercent(p);
  const price = p.salePrice ?? p.price;
  const sizeAvailable = (s: string) => (color ? (p.stock[variantKey(s, color)] ?? 0) > 0 : p.colors.some((c) => (p.stock[variantKey(s, c.name)] ?? 0) > 0));
  const colorAvailable = (c: string) => (size ? (p.stock[variantKey(size, c)] ?? 0) > 0 : p.sizes.some((s) => (p.stock[variantKey(s, c)] ?? 0) > 0));

  const addToCart = () => {
    setAttempted(true);
    if (!size || !color) return toast(`Please select ${!size && !color ? 'a size and colour' : !size ? 'a size' : 'a colour'}`, 'error');
    const res = cart.addItem({ productId: p.id, slug: p.slug, name: p.name, image: p.images[0], unitPrice: price, size, color, quantity: qty, maxStock: stock ?? 0 });
    if (!res.ok) return toast(res.message, 'error');
    cart.openCart(); // the drawer itself is the confirmation
  };

  const liked = wishlist.has(p.id);
  const stockLabel = stock === null ? 'Select a size and colour to see availability'
    : stock === 0 ? 'Out of stock' : stock <= 3 ? `Only ${stock} left in stock` : 'In stock';
  const stockColor = stock === 0 ? 'text-red-600' : stock !== null && stock <= 3 ? 'text-brand' : stock === null ? 'text-neutral-500' : 'text-green-700';

  return (
    <div className="container-x py-6 lg:py-10">
      <nav className="mb-5 text-xs text-neutral-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand">Home</Link> / <Link to="/shop" className="hover:text-brand">Shop</Link> / <Link to={`/shop?category=${encodeURIComponent(p.category)}`} className="hover:text-brand">{p.category}</Link> / <span className="text-neutral-900">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col-reverse gap-3 self-start sm:flex-row lg:sticky lg:top-28">
          <div className="flex gap-3 sm:flex-col">
            {p.images.map((src, i) => (
              <button key={i} onClick={() => setImg(i)} aria-label={`View image ${i + 1}`}
                className={`aspect-square w-20 overflow-hidden border-2 bg-neutral-100 transition-colors ${i === img ? 'border-brand' : 'border-transparent hover:border-neutral-400'}`}>
                <Img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="group relative flex-1 overflow-hidden bg-neutral-100">
            <Img key={img} src={p.images[img]} alt={p.name} loading="eager" className="aspect-[4/5] w-full animate-fade-in object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute left-4 top-4 flex flex-col gap-1.5">
              {p.isNew && <span className="bg-neutral-950 px-3 py-1 font-display text-base font-bold uppercase tracking-wider text-white">New</span>}
              {off > 0 && <span className="bg-brand px-3 py-1 font-display text-base font-bold uppercase tracking-wider text-white">-{off}%</span>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm uppercase tracking-wider text-neutral-500">{p.category} / {p.gender}</p>
          <h1 className="mt-1 text-5xl font-extrabold leading-none sm:text-6xl">{p.name}</h1>
          {p.reviewCount > 0 && <div className="mt-3"><Rating value={p.rating} count={p.reviewCount} size={16} /></div>}
          <div className="mt-4 flex items-baseline gap-3">
            <span className={`text-3xl font-bold ${p.salePrice ? 'text-brand' : ''}`}>{formatPrice(price)}</span>
            {p.salePrice && <span className="text-lg text-neutral-400 line-through">{formatPrice(p.price)}</span>}
          </div>
          <p className="mt-5 leading-relaxed text-neutral-600">{p.description}</p>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">Colour: <span className="font-sans text-base font-normal normal-case">{color ?? 'Select'}</span></h2>
              {attempted && !color && <span className="text-sm font-medium text-red-600">Required</span>}
            </div>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
              {p.colors.map((c) => {
                const ok = colorAvailable(c.name);
                return (
                  <button key={c.name} role="radio" aria-checked={color === c.name} aria-label={c.name} title={ok ? c.name : `${c.name} (unavailable)`}
                    onClick={() => setColor(c.name)} disabled={!ok}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all disabled:cursor-not-allowed disabled:opacity-35 ${color === c.name ? 'border-brand' : 'border-neutral-300 hover:border-neutral-950'}`}>
                    <span className="h-8 w-8 rounded-full border border-black/10" style={{ background: c.hex }} />
                    {!ok && <span className="absolute h-0.5 w-9 rotate-45 bg-neutral-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {!(p.sizes.length === 1 && p.sizes[0] === 'One Size') && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">Size: <span className="font-sans text-base font-normal normal-case">{size ?? 'Select'}</span></h2>
                {attempted && !size && <span className="text-sm font-medium text-red-600">Required</span>}
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                {p.sizes.map((s) => {
                  const ok = sizeAvailable(s);
                  return (
                    <button key={s} role="radio" aria-checked={size === s} disabled={!ok} onClick={() => setSize(s)}
                      className={`h-11 min-w-14 border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:text-neutral-300 disabled:line-through ${size === s ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 hover:border-neutral-950'}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={`mt-4 text-sm font-semibold ${stockColor}`} aria-live="polite">{stockLabel}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QuantitySelector value={qty} max={Math.max(stock ?? 10, 1)} onChange={setQty} />
            <button onClick={addToCart} disabled={stock === 0} className="btn btn-primary min-w-0 flex-1"><ShoppingBag size={20} /> {stock === 0 ? 'Out of stock' : 'Add to cart'}</button>
            <button onClick={() => wishlist.toggle(p.id)} aria-pressed={liked} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
              className="flex h-[52px] w-[52px] items-center justify-center border-2 border-neutral-950 transition-colors hover:bg-neutral-100">
              <Heart size={22} className={liked ? 'fill-brand text-brand' : ''} />
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 bg-neutral-100 p-4 text-sm"><Truck size={22} className="text-brand" /> {freeShippingLabel(shop)}</div>
            <div className="flex items-center gap-3 bg-neutral-100 p-4 text-sm"><RotateCcw size={22} className="text-brand" /> {shop.returns.windowDays ? `${shop.returns.windowDays}-day returns` : <Link to="/returns" className="underline hover:text-brand">Returns policy</Link>}</div>
          </div>

          <div className="mt-6 border-t border-neutral-200">
            <Accordion title="Shipping & Returns">{freeShippingLabel(shop)}, otherwise a flat {formatPrice(shop.shipping.flatRate)} rate. For returns and refunds, see our <Link to="/returns" className="underline hover:text-brand">Returns &amp; Refunds Policy</Link>.</Accordion>
          </div>
        </div>
      </div>

      {p.reviewCount > 0 && (
      <section className="mt-16 border-t border-neutral-200 pt-12" aria-labelledby="reviews">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="reviews" className="text-4xl font-extrabold sm:text-5xl">Customer reviews</h2>
          <div className="flex items-center gap-3"><span className="font-display text-5xl font-extrabold">{p.rating.toFixed(1)}</span><div><Rating value={p.rating} size={18} /><p className="text-xs text-neutral-500">{p.reviewCount} reviews</p></div></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(p.reviews ?? []).map((r) => (
            <article key={r.id} className="border border-neutral-200 p-5">
              <Rating value={r.rating} />
              <h3 className="mt-2 text-xl font-bold">{r.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{r.comment}</p>
              <p className="mt-3 text-xs text-neutral-400">{r.author} &middot; {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </article>
          ))}
        </div>
      </section>
      )}

      {!relError && (
      <section className="mt-16">
        <SectionHeading eyebrow="Complete the look" title="You may also like" linkTo="/shop" />
        <ProductGrid products={related} loading={relLoading} />
      </section>
      )}
    </div>
  );
}
