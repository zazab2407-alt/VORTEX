import { Router } from 'express';
import validate from '../middleware/validate.js';
import * as ctrl from '../controllers/cartController.js';
import { quoteBody } from '../validators/orderValidators.js';

const router = Router();
router.get('/config', ctrl.shopConfig);
router.post('/quote', quoteBody, validate, ctrl.quote);
export default router;
