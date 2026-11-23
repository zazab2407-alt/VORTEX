import { Router } from 'express';
import validate from '../middleware/validate.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { trackLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/orderController.js';
import { createOrderBody, lookupBody, orderNumberParam } from '../validators/orderValidators.js';

const router = Router();

router.post('/', optionalAuth, writeLimiter, createOrderBody, validate, ctrl.create); // guests and customers
router.get('/mine', authenticate, ctrl.mine);
router.post('/lookup', trackLimiter, lookupBody, validate, ctrl.lookup); // guest tracking
router.post('/lookup/cancel', trackLimiter, lookupBody, validate, ctrl.cancelLookup);
router.get('/:orderNumber', authenticate, orderNumberParam, validate, ctrl.getMine);
router.post('/:orderNumber/cancel', authenticate, orderNumberParam, validate, ctrl.cancelMine);

export default router;
