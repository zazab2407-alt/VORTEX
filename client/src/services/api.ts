import type { Category, Paginated, Product, ProductFilters } from '../types';
import { ApiClientError, apiGet } from './http';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Storefront data layer: every component talks to the backend only through these functions. */
export const productService = {
  async list(f: ProductFilters = {}, signal?: AbortSignal): Promise<Paginated<Product>> {
    const { data, meta } = await apiGet<Product[]>('/products', { params: { ...f }, signal });
    return { items: data, meta: meta! };
  },

  /** Resolves to null when the product does not exist (so pages can show a proper 404). */
  async bySlug(slug: string, signal?: AbortSignal): Promise<Product | null> {
    try {
      return (await apiGet<Product>(`/products/${encodeURIComponent(slug)}`, { signal })).data;
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) return null;
      throw e;
    }
  },

  async related(product: Product, limit = 4, signal?: AbortSignal): Promise<Product[]> {
    return (await apiGet<Product[]>(`/products/${product.id}/related`, { params: { limit }, signal })).data;
  },

  /** Ignores ids that cannot be real products (e.g. saved before the backend existed). */
  async byIds(ids: string[], signal?: AbortSignal): Promise<Product[]> {
    const valid = ids.filter((i) => OBJECT_ID.test(i)).slice(0, 50);
    if (valid.length === 0) return [];
    return (await apiGet<Product[]>('/products', { params: { ids: valid.join(','), limit: 50 }, signal })).data;
  },
};

export const categoryService = {
  async list(signal?: AbortSignal): Promise<Category[]> {
    return (await apiGet<Category[]>('/categories', { signal })).data;
  },
};

export const isValidId = (id: string) => OBJECT_ID.test(id);
