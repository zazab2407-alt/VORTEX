import { Minus, Plus } from 'lucide-react';

interface Props { value: number; max: number; onChange: (n: number) => void; small?: boolean }
export default function QuantitySelector({ value, max, onChange, small }: Props) {
  const btn = `flex items-center justify-center transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent ${small ? 'h-8 w-8' : 'h-11 w-11'}`;
  return (
    <div className="inline-flex items-center border border-neutral-300">
      <button type="button" className={btn} disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
      <span className={`text-center text-sm font-semibold ${small ? 'w-8' : 'w-10'}`} aria-live="polite">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
    </div>
  );
}
