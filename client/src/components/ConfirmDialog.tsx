import { useEffect, useRef } from 'react';

interface Props { open: boolean; title: string; message: string; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void }

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md animate-fade-up bg-white p-6 shadow-2xl">
        <h2 id="confirm-title" className="text-3xl font-extrabold">{title}</h2>
        <p id="confirm-msg" className="mt-2 text-sm text-neutral-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="btn btn-outline !px-5 !py-2.5" onClick={onCancel} disabled={busy}>Cancel</button>
          <button ref={confirmRef} className="btn !bg-red-600 !px-5 !py-2.5 text-white hover:!bg-red-700" onClick={onConfirm} disabled={busy}>{busy ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
