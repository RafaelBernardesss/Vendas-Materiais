const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/carrinho.controller');
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');

// Toda a rota exige usuário logado.
router.use(requireAuth);

router.get('/', ctrl.listar);
router.post(
  '/',
  validate({ body: z.object({ materialId: z.coerce.number().int().min(1) }) }),
  ctrl.adicionar
);
router.delete(
  '/:materialId',
  validate({ params: z.object({ materialId: z.coerce.number().int().min(1) }) }),
  ctrl.remover
);

module.exports = router;
