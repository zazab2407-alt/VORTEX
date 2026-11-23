import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { Product } from '../types';
import { discountPercent, formatPrice } from '../utils/format';
import { useWishlist } from '../context/WishlistContext';
import Img from './Img';
import Rating from './Rating';

export default function ProductCard({ product: p }: { product: Product }) {
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const off = discountPercent(p);
  return (
    <article className="group relative">
      <Link to={`/product/${p.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
          <Img src={p.images[0]} alt={p.name} className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-0" />
          <Img src={p.images[1]} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-all duration-700 group-hover:scale-100 group-hover:opacity-100" />
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {p.isNew && <span className="bg-neutral-950 px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider text-white">New</span>}
            {off > 0 && <span className="bg-brand px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider text-white">-{off}%</span>}
          </div>
          <div className="absolute inset-x-0 bottom-0 translate-y-full bg-neutral-950/90 py-3 text-center font-display text-base font-bold uppercase tracking-widest text-white transition-transform duration-300 group-hover:translate-y-0 max-md:hidden">
            View Product
          </div>
        </div>
      </Link>
      <button type="button" onClick={() => toggle(p.id)} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={liked}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow transition-transform hover:scale-110">
        <Heart size={18} className={liked ? 'fill-brand text-brand' : 'text-neutral-800'} />
      </button>
      <div className="pt-3">
        <p className="text-xs uppercase tracking-wider text-neutral-500">{p.category}</p>
        <Link to={`/product/${p.slug}`} className="mt-0.5 block font-semibold leading-snug hover:text-brand">{p.name}</Link>
        <div className="mt-1 flex items-center gap-2">
          {p.salePrice ? (
            <>
              <span className="font-bold text-brand">{formatPrice(p.salePrice)}</span>
              <span className="text-sm text-neutral-400 line-through">{formatPrice(p.price)}</span>
            </>
          ) : <span className="font-bold">{formatPrice(p.price)}</span>}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {p.reviewCount > 0 ? <Rating value={p.rating} count={p.reviewCount} /> : <span />}
          <div className="flex gap-1">
            {p.colors.slice(0, 4).map((c) => (
              <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full border border-neutral-300" style={{ background: c.hex }} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
