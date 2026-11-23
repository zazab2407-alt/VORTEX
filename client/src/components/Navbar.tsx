import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const LINKS = [
  { to: '/shop', label: 'Shop All' },
  { to: '/shop?gender=men', label: 'Men' },
  { to: '/shop?gender=women', label: 'Women' },
  { to: '/shop?collection=new', label: 'New Arrivals' },
  { to: '/shop?collection=sale', label: 'Sale', accent: true },
];

export default function Navbar() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { count, openCart } = useCart();
  const wishlist = useWishlist();
  const { user, logout } = useAuth();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { if (search) inputRef.current?.focus(); }, [search]);
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : ''; }, [menu]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
    setSearch(false);
    setQ('');
  };

  const icon = 'relative flex h-10 w-10 items-center justify-center transition-colors hover:text-brand';
  return (
    <header className={`sticky top-0 z-40 bg-white transition-shadow ${scrolled ? 'shadow-md' : 'border-b border-neutral-200'}`}>
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-20">
        <button className={`${icon} lg:hidden`} onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={24} /></button>
        <div className="max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2"><Logo /></div>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} end
              className={`font-display text-xl font-semibold uppercase tracking-wider transition-colors hover:text-brand ${l.accent ? 'text-brand' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center">
          <button className={icon} onClick={() => setSearch((s) => !s)} aria-label="Search">{search ? <X size={22} /> : <Search size={22} />}</button>
          <Link to="/wishlist" className={`${icon} max-sm:hidden`} aria-label="Wishlist">
            <Heart size={22} />
            {wishlist.ids.length > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[10px] font-bold text-white">{wishlist.ids.length}</span>}
          </Link>
          <Link to={user ? '/account' : '/login'} className={`${icon} max-sm:hidden`} aria-label={user ? 'My account' : 'Log in'}>
            <UserIcon size={22} />
            {user && <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />}
          </Link>
          <button className={icon} onClick={openCart} aria-label={`Open cart, ${count} items`}>
            <ShoppingBag size={22} />
            {count > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>}
          </button>
        </div>
      </div>

      {search && (
        <form onSubmit={submit} className="animate-fade-in border-t border-neutral-200 bg-white">
          <div className="container-x flex items-center gap-3 py-3">
            <Search size={20} className="text-neutral-400" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leggings, hoodies, shorts..." className="h-10 flex-1 bg-transparent text-base outline-none" />
            <button className="font-display text-lg font-bold uppercase tracking-wider text-brand">Search</button>
          </div>
        </form>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm animate-slide-right flex-col bg-neutral-950 p-6 text-white">
            <div className="mb-8 flex items-center justify-between">
              <Logo light />
              <button onClick={() => setMenu(false)} aria-label="Close menu"><X size={26} /></button>
            </div>
            <nav className="flex flex-1 flex-col gap-1" aria-label="Mobile">
              {LINKS.map((l) => (
                <Link key={l.label} to={l.to} onClick={() => setMenu(false)}
                  className={`border-b border-white/10 py-4 font-display text-3xl font-bold uppercase tracking-wide ${l.accent ? 'text-brand' : ''}`}>
                  {l.label}
                </Link>
              ))}
              <Link to="/wishlist" onClick={() => setMenu(false)} className="flex items-center gap-2 py-4 font-display text-2xl font-semibold uppercase">
                <Heart size={20} /> Wishlist ({wishlist.ids.length})
              </Link>
              <Link to={user ? '/account' : '/login'} onClick={() => setMenu(false)} className="flex items-center gap-2 py-4 font-display text-2xl font-semibold uppercase">
                <UserIcon size={20} /> {user ? 'My account' : 'Log in'}
              </Link>
              {user?.role === 'admin' && <Link to="/admin" onClick={() => setMenu(false)} className="py-2 font-display text-2xl font-semibold uppercase text-brand">Admin dashboard</Link>}
              {user && <button onClick={async () => { await logout(); setMenu(false); }} className="py-2 text-left font-display text-2xl font-semibold uppercase text-neutral-400">Log out</button>}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}
