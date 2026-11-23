import type { AdminCoupon, AdminCustomer, AdminCustomerDetail, AdminOrderRow, AdminStats, Category, CouponState, Gender, Order, OrderStatus, Paginated, Product } from '../types';
import { apiGet, apiSend } from './http';

export interface ProductInput {
  name: string; description: string; price: number; salePrice?: number | null; images: string[]; category: string; gender: Gender;
  sizes: string[]; colors: { name: string; hex: string }[]; variants?: { size: string; color: string; stock: number }[]; isFeatured: boolean; isActive: boolean;
}
export interface CategoryInput { name: string; description?: string; image?: string; isActive?: boolean }
/** Rules only: the discount a shopper actually gets is always recalculated by the server at checkout. */
export interface CouponInput {
  code?: string; type?: 'percentage' | 'fixed'; value?: number; minSubtotal?: number | null; expiresAt?: string | null; usageLimit?: number | null; isActive?: boolean;
}

/** Admin-only calls. The server checks the login cookie and role on every one of them. */
export const adminService = {
  async stats(signal?: AbortSignal) { return (await apiGet<AdminStats>('/admin/stats', { signal })).data; },

  async products(params: { q?: string; page?: number; limit?: number; sort?: string }, signal?: AbortSignal): Promise<Paginated<Product>> {
    const { data, meta } = await apiGet<Product[]>('/admin/products', { params, signal });
    return { items: data, meta: meta! };
  },
  async product(id: string, signal?: AbortSignal) { return (await apiGet<Product>(`/admin/products/${id}`, { signal })).data; },
  async createProduct(input: ProductInput) { return (await apiSend<Product>('POST', '/products', input)).data; },
  async updateProduct(id: string, patch: Partial<ProductInput>) { return (await apiSend<Product>('PATCH', `/products/${id}`, patch)).data; },
  async deleteProduct(id: string) { await apiSend('DELETE', `/products/${id}`); },
  async setStock(id: string, size: string, color: string, stock: number) { return (await apiSend<Product>('PATCH', `/products/${id}/stock`, { size, color, stock })).data; },
  async uploadImage(file: File): Promise<{ url: string; width: number; height: number }> {
    const form = new FormData();
    form.append('image', file);
    return (await apiSend<{ url: string; width: number; height: number }>('POST', '/admin/uploads', form, { timeoutMs: 60000 })).data;
  },

  async orders(params: { q?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }, signal?: AbortSignal): Promise<Paginated<AdminOrderRow>> {
    const { data, meta } = await apiGet<AdminOrderRow[]>('/admin/orders', { params, signal });
    return { items: data, meta: meta! };
  },
  async order(id: string, signal?: AbortSignal) { return (await apiGet<Order>(`/admin/orders/${id}`, { signal })).data; },
  async updateOrderStatus(id: string, status: OrderStatus, note?: string) { return (await apiSend<Order>('PATCH', `/admin/orders/${id}/status`, { status, ...(note && { note }) })).data; },

  async categories(signal?: AbortSignal) { return (await apiGet<Category[]>('/admin/categories', { signal })).data; },
  async createCategory(input: CategoryInput) { return (await apiSend<Category>('POST', '/categories', input)).data; },
  async updateCategory(id: string, patch: CategoryInput) { return (await apiSend<Category>('PATCH', `/categories/${id}`, patch)).data; },
  async deleteCategory(id: string) { await apiSend('DELETE', `/categories/${id}`); },

  async coupons(params: { q?: string; status?: CouponState | '' }, signal?: AbortSignal) { return (await apiGet<AdminCoupon[]>('/admin/coupons', { params, signal })).data; },
  async createCoupon(input: CouponInput) { return (await apiSend<AdminCoupon>('POST', '/admin/coupons', input)).data; },
  async updateCoupon(id: string, patch: CouponInput) { return (await apiSend<AdminCoupon>('PATCH', `/admin/coupons/${id}`, patch)).data; },
  async deleteCoupon(id: string) { await apiSend('DELETE', `/admin/coupons/${id}`); },

  async customers(params: { q?: string; status?: string; page?: number; limit?: number }, signal?: AbortSignal): Promise<Paginated<AdminCustomer>> {
    const { data, meta } = await apiGet<AdminCustomer[]>('/admin/customers', { params, signal });
    return { items: data, meta: meta! };
  },
  async customer(id: string, signal?: AbortSignal) { return (await apiGet<AdminCustomerDetail>(`/admin/customers/${id}`, { signal })).data; },
  async setCustomerActive(id: string, isActive: boolean) { return (await apiSend<AdminCustomer>('PATCH', `/admin/customers/${id}/status`, { isActive })).data; },
};
