import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, ExternalLink, FolderTree, LayoutDashboard, LogOut, Package, Ticket, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/Logo';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/customers', label: 'Customers', icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const out = async () => { await logout(); toast('You have been logged out'); navigate('/login'); };

  return (
    <div className="min-h-screen bg-neutral-100 lg:flex">
      <aside className="bg-neutral-950 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-3 p-4 lg:p-6">
          <div className="flex items-center gap-3"><Logo light /><span className="bg-brand px-2 py-0.5 font-display text-sm font-bold uppercase tracking-widest">Admin</span></div>
          <div className="flex items-center gap-1 lg:hidden">
            <Link to="/" aria-label="View store" className="flex h-10 w-10 items-center justify-center hover:text-brand"><ExternalLink size={20} /></Link>
            <button onClick={out} aria-label="Log out" className="flex h-10 w-10 items-center justify-center hover:text-brand"><LogOut size={20} /></button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4 lg:pb-0" aria-label="Admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-2.5 whitespace-nowrap px-4 py-2.5 font-display text-xl font-semibold uppercase tracking-wide transition-colors ${isActive ? 'bg-brand text-white' : 'text-neutral-300 hover:bg-white/10'}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-neutral-400">{user?.email}</p>
          <Link to="/" className="mt-3 flex items-center gap-2 py-1 text-sm text-neutral-300 hover:text-brand"><ExternalLink size={15} /> View store</Link>
          <button onClick={out} className="flex items-center gap-2 py-1 text-sm text-neutral-300 hover:text-brand"><LogOut size={15} /> Log out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10"><Outlet /></main>
    </div>
  );
}
