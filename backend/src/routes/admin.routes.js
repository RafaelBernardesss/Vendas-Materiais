const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/admin.controller');
const { validate } = require('../middlewares/validate');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { uploadMaterial, uploadFotos } = require('../middlewares/upload');

// Toda a rota exige usuário ADMIN.
router.use(requireAuth, requireAdmin);

router.get('/materiais', ctrl.listar);

// Multipart: titulo, preco, descricao (opcional) + arquivos[] (até 20) + fotos[] (até 10)
router.post('/materiais', uploadMaterial, ctrl.publicar);

// Fotos do anúncio de um material já publicado
router.post(
  '/materiais/:id/fotos',
  validate({ params: z.object({ id: z.coerce.number().int().min(1) }) }),
  uploadFotos,
  ctrl.adicionarFotos
);
router.delete(
  '/fotos/:fotoId',
  validate({ params: z.object({ fotoId: z.coerce.number().int().min(1) }) }),
  ctrl.removerFoto
);

router.put(
  '/materiais/:id',
  validate({
    params: z.object({ id: z.coerce.number().int().min(1) }),
    body: z
      .object({
        titulo: z.string().trim().min(2, 'Título muito curto.').optional(),
        preco: z.union([z.string(), z.number()]).optional(),
        descricao: z.string().trim().nullable().optional(),
      })
      .refine((v) => v.titulo !== undefined || v.preco !== undefined || v.descricao !== undefined, {
        message: 'Nada para atualizar.',
      }),
  }),
  ctrl.editar
);

router.delete(
  '/materiais/:id',
  validate({ params: z.object({ id: z.coerce.number().int().min(1) }) }),
  ctrl.excluir
);

module.exports = router;
