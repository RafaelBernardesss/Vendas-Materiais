const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/downloads.controller');
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/meus', ctrl.meus);
router.get(
  '/arquivo/:fileId',
  validate({ params: z.object({ fileId: z.coerce.number().int().min(1) }) }),
  ctrl.baixarArquivo
);
router.get(
  '/material/:materialId',
  validate({ params: z.object({ materialId: z.coerce.number().int().min(1) }) }),
  ctrl.baixarZip
);

module.exports = router;
