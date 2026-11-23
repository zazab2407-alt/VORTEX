import type { Product } from '../types';
import ProductCard from './ProductCard';
import Reveal from './Reveal';

export function ProductSkeletons({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/5] bg-neutral-200" />
          <div className="mt-3 h-3 w-1/3 bg-neutral-200" />
          <div className="mt-2 h-4 w-3/4 bg-neutral-200" />
          <div className="mt-2 h-4 w-1/4 bg-neutral-200" />
        </div>
      ))}
    </>
  );
}

interface Props { products: Product[] | null; loading?: boolean; cols?: string; skeletons?: number; className?: string }
export default function ProductGrid({ products, loading, cols = 'grid-cols-2 lg:grid-cols-4', skeletons = 4, className = '' }: Props) {
  return (
    <div className={`grid gap-x-4 gap-y-8 sm:gap-x-6 ${cols} ${className}`}>
      {loading || !products ? <ProductSkeletons count={skeletons} /> : products.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 80}><ProductCard product={p} /></Reveal>
      ))}
    </div>
  );
}
