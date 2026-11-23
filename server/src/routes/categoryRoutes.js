import { Router } from 'express';
import { param } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import * as ctrl from '../controllers/categoryController.js';
import { categoryBody } from '../validators/categoryValidators.js';
import { idParam } from '../validators/productValidators.js';

const router = Router();
const keyParam = [param('idOrSlug').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Invalid category identifier')];

router.get('/', ctrl.list);
router.get('/:idOrSlug', keyParam, validate, ctrl.getOne);

router.post('/', requireAdmin, categoryBody(), validate, ctrl.create);
router.put('/:id', requireAdmin, idParam, categoryBody({ partial: true }), validate, ctrl.update);
router.patch('/:id', requireAdmin, idParam, categoryBody({ partial: true }), validate, ctrl.update);
router.delete('/:id', requireAdmin, idParam, validate, ctrl.remove);

export default router;
