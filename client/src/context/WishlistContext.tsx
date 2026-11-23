import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { isValidId } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToast } from './ToastContext';

interface WishlistCtx { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void; retain: (keep: string[]) => void }
const Ctx = createContext<WishlistCtx | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useLocalStorage<string[]>('vortex_wishlist', []);
  const { toast } = useToast();
  useEffect(() => { if (ids.some((i) => !isValidId(i))) setIds((l) => l.filter(isValidId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const has = (id: string) => ids.includes(id);
  const toggle = (id: string) => {
    toast(has(id) ? 'Removed from wishlist' : 'Saved to wishlist');
    setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };
  return <Ctx.Provider value={{ ids, has, toggle, retain: (keep) => setIds((l) => l.filter((i) => keep.includes(i))) }}>{children}</Ctx.Provider>;
}
export const useWishlist = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWishlist must be used inside WishlistProvider');
  return c;
};
