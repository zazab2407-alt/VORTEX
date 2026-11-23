import { Router } from 'express';
import validate from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import * as ctrl from '../controllers/productController.js';
import { idOrSlugParam, idParam, productBody, productListQuery, relatedQuery, stockBody } from '../validators/productValidators.js';

const router = Router();

// Public
router.get('/', productListQuery, validate, ctrl.list);
router.get('/:idOrSlug/related', idOrSlugParam, relatedQuery, validate, ctrl.related);
router.get('/:idOrSlug', idOrSlugParam, validate, ctrl.getOne);

// Admin only: valid login cookie AND role === admin
router.post('/', requireAdmin, productBody(), validate, ctrl.create);
router.put('/:id', requireAdmin, idParam, productBody({ partial: true }), validate, ctrl.update);
router.patch('/:id', requireAdmin, idParam, productBody({ partial: true }), validate, ctrl.update);
router.patch('/:id/stock', requireAdmin, idParam, stockBody, validate, ctrl.setStock);
router.delete('/:id', requireAdmin, idParam, validate, ctrl.remove);

export default router;
