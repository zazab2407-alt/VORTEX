import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { useShopConfig } from '../hooks/useShopConfig';
import { freeShippingLabel } from '../utils/storeText';

const col = 'mb-4 font-display text-xl font-bold uppercase tracking-widest text-white';
const link = 'block py-1 text-sm text-neutral-400 transition-colors hover:text-brand';

// Social links are intentionally hidden until real account URLs are provided by the business.

export default function Footer() {
  const { categories } = useCategories();
  const { user } = useAuth();
  const shop = useShopConfig();
  return (
    <footer className="bg-neutral-950 text-neutral-300">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-neutral-400">Premium sportswear engineered for people who train hard and live harder.</p>
        </div>
        <div>
          <h3 className={col}>Shop</h3>
          <Link className={link} to="/shop?gender=men">Men</Link>
          <Link className={link} to="/shop?gender=women">Women</Link>
          <Link className={link} to="/shop?collection=new">New Arrivals</Link>
          <Link className={link} to="/shop?collection=best">Best Sellers</Link>
          <Link className={link} to="/shop?collection=sale">Sale</Link>
        </div>
        <div>
          <h3 className={col}>Categories</h3>
          {(categories ?? []).map((c) => (
            <Link key={c.id} className={link} to={`/shop?category=${encodeURIComponent(c.name)}`}>{c.name}</Link>
          ))}
        </div>
        <div>
          <h3 className={col}>Quick Links</h3>
          <Link className={link} to="/cart">Shopping Cart</Link>
          <Link className={link} to="/wishlist">Wishlist</Link>
          <Link className={link} to="/track-order">Track Order</Link>
          <Link className={link} to="/faq">FAQ</Link>
          <Link className={link} to="/contact">Contact Us</Link>
          <Link className={link} to="/returns">Returns &amp; Refunds</Link>
          <Link className={link} to="/privacy">Privacy Policy</Link>
          <Link className={link} to={user ? '/account' : '/login'}>{user ? 'My Account' : 'Log in'}</Link>
          <p className="mt-4 text-sm text-neutral-400">{freeShippingLabel(shop)}.<br />See our <Link to="/returns" className="underline hover:text-brand">Returns &amp; Refunds Policy</Link>.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-500">
        <nav aria-label="Legal" className="mb-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link to="/privacy" className="hover:text-brand">Privacy Policy</Link>
          <Link to="/returns" className="hover:text-brand">Returns &amp; Refunds</Link>
          <Link to="/faq" className="hover:text-brand">FAQ</Link>
          <Link to="/contact" className="hover:text-brand">Contact</Link>
        </nav>
        &copy; {new Date().getFullYear()} {shop.storeName} Sportswear. All rights reserved.
      </div>
    </footer>
  );
}
