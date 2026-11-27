import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import AnnouncementBar from './AnnouncementBar';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname, search]);
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        {/* A crashing page shows the fallback here while the navbar, footer and cart drawer keep working; changing route resets it */}
        <ErrorBoundary scope="route" resetKey={pathname} homeLink={<Link to="/" className="btn btn-outline">Back to Store</Link>}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
