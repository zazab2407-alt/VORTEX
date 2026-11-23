import { Router } from 'express';
import validate from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadImage as parseUpload } from '../middleware/upload.js';
import * as ctrl from '../controllers/adminController.js';
import * as coupons from '../controllers/couponController.js';
import * as customers from '../controllers/customerController.js';
import { idParam, productListQuery } from '../validators/productValidators.js';
import { adminOrderQuery, statusBody } from '../validators/orderValidators.js';
import { couponBody, couponListQuery } from '../validators/couponValidators.js';
import { customerListQuery, customerStatusBody } from '../validators/customerValidators.js';

const router = Router();
router.use(requireAdmin); // nothing under /api/admin is reachable without a valid admin session

router.get('/stats', ctrl.stats);
router.get('/products', productListQuery, validate, ctrl.listAllProducts);
router.get('/products/:id', idParam, validate, ctrl.getAnyProduct);
router.get('/categories', ctrl.listAllCategories);
router.post('/uploads', parseUpload, ctrl.uploadImage);

router.get('/orders', adminOrderQuery, validate, ctrl.listOrders);
router.get('/orders/:id', idParam, validate, ctrl.getOrder);
router.patch('/orders/:id/status', idParam, statusBody, validate, ctrl.updateOrderStatus);

router.get('/coupons', couponListQuery, validate, coupons.listCoupons);
router.post('/coupons', couponBody(), validate, coupons.createCoupon);
router.get('/coupons/:id', idParam, validate, coupons.getCoupon);
router.patch('/coupons/:id', idParam, couponBody({ partial: true }), validate, coupons.updateCoupon);
router.delete('/coupons/:id', idParam, validate, coupons.deleteCoupon);

router.get('/customers', customerListQuery, validate, customers.listCustomers);
router.get('/customers/:id', idParam, validate, customers.getCustomer);
router.patch('/customers/:id/status', idParam, customerStatusBody, validate, customers.setCustomerStatus);

export default router;
