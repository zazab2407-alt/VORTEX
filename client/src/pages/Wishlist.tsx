import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { productService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useWishlist } from '../context/WishlistContext';
import ProductGrid from '../components/ProductGrid';
import ErrorState from '../components/ErrorState';

export default function Wishlist() {
  useDocumentTitle('Wishlist');
  const { ids, retain } = useWishlist();
  const { data, loading, error, reload } = useAsync((s) => productService.byIds(ids, s), [ids.join(',')]);

  // Forget saved products that no longer exist (deleted or hidden by the store)
  useEffect(() => {
    if (!data) return;
    const found = new Set(data.map((p) => p.id));
    if (ids.some((id) => !found.has(id))) retain([...found]);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="mb-8 text-5xl font-extrabold sm:text-6xl">Wishlist</h1>
      {ids.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Heart size={64} className="text-neutral-300" />
          <p className="mt-4 font-display text-3xl font-bold uppercase">Nothing saved yet</p>
          <p className="mt-1 text-neutral-500">Tap the heart on any product to save it here.</p>
          <Link to="/shop" className="btn btn-primary mt-8">Browse Products</Link>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : <ProductGrid products={data} loading={loading} skeletons={Math.min(ids.length, 8)} />}
    </div>
  );
}
