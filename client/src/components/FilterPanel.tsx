import type { Gender, ProductFilters } from '../types';
import { ALL_SIZES, FILTER_COLORS } from '../data/catalog';
import { useCategories } from '../hooks/useCategories';
import { useShopConfig } from '../hooks/useShopConfig';

export const PRICE_MIN = 0;
export const PRICE_MAX = 150;

interface Props { filters: ProductFilters; onChange: (patch: Partial<ProductFilters>) => void; onClear: () => void }

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-b border-neutral-200 py-5" aria-label={title}>
    <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none tracking-wider">{title}</h3>
    {children}
  </section>
);

export default function FilterPanel({ filters, onChange, onClear }: Props) {
  const { categories, loading: catLoading } = useCategories();
  const { currencySymbol } = useShopConfig();
  const categoryNames = categories?.map((c) => c.name) ?? [];
  const min = filters.minPrice ?? PRICE_MIN;
  const max = filters.maxPrice ?? PRICE_MAX;
  const chip = (active: boolean) =>
    `border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 hover:border-neutral-950'}`;

  return (
    <div>
      <button onClick={onClear} className="mb-1 text-sm font-semibold text-brand underline underline-offset-4">Clear all filters</button>

      <Group title="Gender">
        <div className="flex flex-wrap gap-2">
          {(['men', 'women'] as Gender[]).map((g) => (
            <button key={g} onClick={() => onChange({ gender: filters.gender === g ? undefined : g })} className={`${chip(filters.gender === g)} capitalize`}>{g}</button>
          ))}
        </div>
      </Group>

      <Group title="Category">
        <div className="space-y-1">
          {catLoading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="my-2 h-4 w-3/4 animate-pulse bg-neutral-200" />)}
          {categoryNames.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
              <input type="radio" name="category" className="peer sr-only" checked={filters.category === c}
                onChange={() => onChange({ category: filters.category === c ? undefined : c })}
                onClick={() => filters.category === c && onChange({ category: undefined })} />
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 peer-checked:border-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                {filters.category === c && <span className="h-2 w-2 rounded-full bg-brand" />}
              </span>
              {c}
            </label>
          ))}
        </div>
      </Group>

      <Group title="Size">
        <div className="flex flex-wrap gap-2">
          {ALL_SIZES.map((s) => (
            <button key={s} onClick={() => onChange({ size: filters.size === s ? undefined : s })} className={chip(filters.size === s)}>{s}</button>
          ))}
        </div>
      </Group>

      <Group title="Colour">
        <div className="flex flex-wrap gap-2.5">
          {FILTER_COLORS.map((c) => {
            const active = filters.color === c.name;
            return (
              <button key={c.name} title={c.name} aria-label={c.name} aria-pressed={active}
                onClick={() => onChange({ color: active ? undefined : c.name })}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${active ? 'border-brand' : 'border-neutral-300'}`}>
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: c.hex }} />
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Price">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold"><span>{currencySymbol}{min}</span><span>{currencySymbol}{max}{max === PRICE_MAX ? '+' : ''}</span></div>
        <label className="text-xs text-neutral-500">Min
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={5} value={min} className="w-full"
            onChange={(e) => { const v = Math.min(+e.target.value, max - 5); onChange({ minPrice: v <= PRICE_MIN ? undefined : v }); }} />
        </label>
        <label className="text-xs text-neutral-500">Max
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={5} value={max} className="w-full"
            onChange={(e) => { const v = Math.max(+e.target.value, min + 5); onChange({ maxPrice: v >= PRICE_MAX ? undefined : v }); }} />
        </label>
      </Group>
    </div>
  );
}
