import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';
interface Toast { id: number; message: string; type: ToastType }
const Ctx = createContext<{ toast: (m: string, t?: ToastType) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = (id: number) => setItems((l) => l.filter((t) => t.id !== id));
  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-2), { id, message, type }]);
    setTimeout(() => dismiss(id), 3200);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 max-lg:bottom-[var(--toast-bottom-mobile,1rem)] left-4 right-4 z-[100] flex flex-col items-center gap-2 sm:left-auto sm:right-6 sm:items-end" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="flex w-full max-w-sm animate-fade-up items-center gap-3 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white shadow-2xl">
            {t.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-brand" /> : <AlertCircle size={18} className="shrink-0 text-red-400" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={16} className="text-white/60 hover:text-white" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
};
