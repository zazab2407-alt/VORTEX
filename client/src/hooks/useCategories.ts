import { useEffect, useState } from 'react';
import { categoryService } from '../services/api';
import type { Category } from '../types';

let cache: Promise<Category[]> | null = null; // categories change rarely: fetch once per page load, share across components

export function useCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    cache ??= categoryService.list().catch((e) => { cache = null; throw e; });
    cache.then((c) => live && setCategories(c)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);
  return { categories, loading: !categories && !failed, failed };
}
