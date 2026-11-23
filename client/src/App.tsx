import { Fragment, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { useShopSettings } from './hooks/useShopConfig';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { CartProvider } from './context/CartContext';
import Layout from './components/Layout';
import { PageSpinner, RequireAdmin, RequireAuth } from './components/RouteGuards';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import OrderDetail from './pages/OrderDetail';
import TrackOrder from './pages/TrackOrder';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import NotFound from './pages/NotFound';
import Faq from './pages/Faq';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Returns from './pages/Returns';

// The admin area is loaded only when an admin opens it, so shoppers never download it
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/OrderDetail'));
const AdminProductForm = lazy(() => import('./pages/admin/ProductForm'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminCustomerDetail = lazy(() => import('./pages/admin/CustomerDetail'));

/**
 * formatPrice() reads a module-level formatter, so pages do not re-render when the server's currency arrives.
 * The key only changes when the server's currency or locale differs from the defaults, so a USD store never remounts,
 * and a store configured for another currency remounts the page tree once when its settings load.
 */
function ConfigGate({ children }: { children: ReactNode }) {
  const { config } = useShopSettings();
  return <Fragment key={`${config.currency}|${config.locale}`}>{children}</Fragment>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <ConfigGate>
              <Suspense fallback={<PageSpinner />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="shop" element={<Shop />} />
                    <Route path="product/:slug" element={<ProductDetail />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="wishlist" element={<Wishlist />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="order-confirmation/:orderNumber" element={<OrderConfirmation />} />
                    <Route path="orders/:orderNumber" element={<RequireAuth><OrderDetail /></RequireAuth>} />
                    <Route path="track-order" element={<TrackOrder />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
                    <Route path="faq" element={<Faq />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="privacy" element={<Privacy />} />
                    <Route path="returns" element={<Returns />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="orders/:id" element={<AdminOrderDetail />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="products/new" element={<AdminProductForm />} />
                    <Route path="products/:id" element={<AdminProductForm />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="customers/:id" element={<AdminCustomerDetail />} />
                  </Route>
                </Routes>
              </Suspense>
              </ConfigGate>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
