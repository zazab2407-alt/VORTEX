import { Router } from 'express';
import mongoose from 'mongoose';
import categoryRoutes from './categoryRoutes.js';
import productRoutes from './productRoutes.js';
import authRoutes from './authRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import adminRoutes from './adminRoutes.js';
import contactRoutes from './contactRoutes.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
router.get('/health', (_req, res) => {
  const db = DB_STATES[mongoose.connection.readyState] ?? 'unknown';
  res.status(db === 'connected' ? 200 : 503).json({ success: true, service: 'vortex-api', db, uptime: Math.round(process.uptime()) });
});

// Responses that carry personal or session data must never be stored by browsers or shared caches
router.use(['/auth', '/orders', '/admin', '/contact'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/contact', contactRoutes);


export default router;
