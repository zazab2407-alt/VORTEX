import { Router } from 'express';
import validate from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/contactController.js';
import { contactBody } from '../validators/contactValidators.js';

const router = Router();
router.post('/', contactLimiter, contactBody, validate, ctrl.sendMessage);

export default router;
