import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '../types';

/** 1 … 4 5 6 … 12 style page list. */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
}

export default function Pagination({ meta, onChange }: { meta: PageMeta; onChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  const base = 'flex h-11 min-w-11 items-center justify-center border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35';
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li><button className={`${base} border-neutral-300 hover:border-neutral-950`} disabled={!meta.hasPrev} onClick={() => onChange(meta.page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button></li>
        {pageList(meta.page, meta.totalPages).map((p, i) => (
          <li key={`${p}-${i}`}>
            {p === '…' ? <span className="px-1 text-neutral-400" aria-hidden="true">…</span> : (
              <button onClick={() => onChange(p)} aria-label={`Page ${p}`} aria-current={p === meta.page ? 'page' : undefined}
                className={`${base} ${p === meta.page ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 hover:border-neutral-950'}`}>{p}</button>
            )}
          </li>
        ))}
        <li><button className={`${base} border-neutral-300 hover:border-neutral-950`} disabled={!meta.hasNext} onClick={() => onChange(meta.page + 1)} aria-label="Next page"><ChevronRight size={18} /></button></li>
      </ul>
      <p className="text-xs text-neutral-500">Showing {first}–{last} of {meta.total}</p>
    </nav>
  );
}
