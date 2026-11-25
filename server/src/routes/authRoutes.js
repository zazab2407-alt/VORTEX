import { Router } from 'express';
import validate from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, loginAccountLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/authController.js';
import { loginBody, passwordBody, profileBody, registerBody } from '../validators/authValidators.js';

const router = Router();

router.post('/register', authLimiter, registerBody, validate, ctrl.register);
router.post('/login', authLimiter, loginAccountLimiter, loginBody, validate, ctrl.login);
router.post('/logout', ctrl.logout);

router.get('/session', ctrl.session);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, profileBody, validate, ctrl.updateMe);
router.put('/password', authenticate, authLimiter, passwordBody, validate, ctrl.changePassword);

export default router;
