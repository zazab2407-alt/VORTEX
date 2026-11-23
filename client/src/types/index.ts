export type Gender = 'men' | 'women' | 'unisex';
export interface ColorOption { name: string; hex: string }
export interface Review { id: string; author: string; rating: number; title: string; comment: string; date: string }

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  images: string[];
  category: string;
  categorySlug?: string;
  gender: Gender;
  sizes: string[];
  colors: ColorOption[];
  /** Variant-level stock, keyed by `${size}|${colorName}` */
  stock: Record<string, number>;
  rating: number;
  reviewCount: number;
  sold: number;
  totalStock?: number;
  categoryId?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  createdAt: string;
  reviews?: Review[]; // only on the single-product endpoint
}

export interface CartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  unitPrice: number;
  size: string;
  color: string;
  quantity: number;
  maxStock: number;
}

export interface Category { id: string; name: string; slug: string; description: string; image: string; isActive?: boolean; productCount?: number }
export interface PageMeta { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
export interface Paginated<T> { items: T[]; meta: PageMeta }

export type SortOption = 'newest' | 'best' | 'price-asc' | 'price-desc';
export interface ProductFilters {
  q?: string;
  category?: string;
  gender?: Gender;
  exactGender?: boolean;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  collection?: 'new' | 'best' | 'sale';
  sort?: SortOption;
  page?: number;
  limit?: number;
}

export interface User { id: string; name: string; email: string; role: 'customer' | 'admin'; phone: string; address: string; city: string; createdAt: string }
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export interface OrderSummary {
  id: string; orderNumber: string; status: OrderStatus; paymentMethod: string; paymentStatus: string; total: number; itemCount: number; canCancel?: boolean;
  items: { name: string; size: string; color: string; quantity: number }[]; createdAt: string; customerName?: string;
}
export interface AdminStats {
  totals: { orders: number; revenue: number; products: number; customers: number; pendingOrders: number };
  lowStock: { threshold: number; total: number; items: { id: string; name: string; slug: string; size: string; color: string; stock: number }[] };
  recentOrders: OrderSummary[];
  bestSellers: { id: string; name: string; slug: string; sold: number; price: number; image: string }[];
}

export interface QuoteLine {
  productId: string; slug?: string; name: string; image?: string; size: string; color: string; quantity: number;
  unitPrice?: number; originalPrice?: number; lineTotal?: number; available: number;
  status: 'ok' | 'insufficient' | 'out_of_stock' | 'unavailable'; message?: string;
  options?: { sizes: string[]; colors: ColorOption[]; stock: Record<string, number> };
}
export interface CartQuote {
  lines: QuoteLine[]; subtotal: number; discount: number; shipping: number; total: number; hasIssues: boolean;
  coupon: { code: string; valid: boolean; error?: string; type?: 'percentage' | 'fixed'; value?: number } | null;
  freeShipping: { threshold: number; remaining: number };
}
/** Public store settings from GET /api/cart/config. Everything price-, shipping- and policy-related shown in the UI comes from here. */
export interface ShopConfig {
  currency: string; currencySymbol: string; locale: string; storeName: string;
  shipping: { flatRate: number; freeThreshold: number };
  contact: { formEnabled: boolean; email: string | null; phone: string | null; address: string | null };
  returns: { windowDays: number | null };
  promoCode: string | null;
}

export type CouponState = 'active' | 'inactive' | 'expired' | 'exhausted';
export interface AdminCoupon {
  id: string; code: string; type: 'percentage' | 'fixed'; value: number; minSubtotal: number; expiresAt: string | null; usageLimit: number | null; usedCount: number;
  isActive: boolean; state: CouponState; orderCount: number; canDelete: boolean; createdAt: string;
}
export interface AdminCustomer {
  id: string; name: string; email: string; phone: string; address: string; city: string; isActive: boolean; createdAt: string;
  orderCount: number; totalSpent: number; lastOrderAt: string | null;
}
export interface AdminCustomerDetail { customer: AdminCustomer; orders: OrderSummary[]; ordersShown: number; ordersTotal: number }

export interface OrderItem { productId: string; name: string; slug?: string; image?: string; size: string; color: string; unitPrice: number; quantity: number; lineTotal: number }
export interface OrderHistoryEntry { status: OrderStatus; at: string; note?: string; by?: string }
export interface Order {
  id: string; orderNumber: string; status: OrderStatus; paymentMethod: string; paymentStatus: string;
  customer: { fullName: string; email: string; phone: string };
  shippingAddress: { address: string; city: string; notes: string };
  items: OrderItem[]; subtotal: number; couponCode: string | null; discount: number; shippingCost: number; total: number;
  createdAt: string; statusHistory: OrderHistoryEntry[]; canCancel: boolean;
  // admin only
  isGuest?: boolean; confirmationEmail?: string | null; stockRestoredAt?: string | null; nextStatuses?: OrderStatus[];
}
export interface AdminOrderRow {
  id: string; orderNumber: string; status: OrderStatus; paymentMethod: string; paymentStatus: string; total: number; itemCount: number; createdAt: string;
  customer: { fullName: string; email: string; phone: string }; city: string; isGuest: boolean;
}
export interface CreateOrderPayload {
  items: { productId: string; size: string; color: string; quantity: number }[]; couponCode?: string | null;
  customer: { fullName: string; email: string; phone: string }; shippingAddress: { address: string; city: string; notes?: string };
  paymentMethod: 'cod'; idempotencyKey: string;
}
