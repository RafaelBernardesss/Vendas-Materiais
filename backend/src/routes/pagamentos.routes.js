const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/pagamentos.controller');
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const cpfSvc = require('../services/cpf');

const schemaCriar = z.object({
  nomeCompleto: z
    .string({ required_error: 'Informe seu nome completo.' })
    .trim()
    .min(5, 'Informe seu nome completo.'),
  cpf: z
    .string({ required_error: 'Informe seu CPF.' })
    .trim()
    .refine(cpfSvc.validarCpf, 'CPF inválido. Confira os dígitos.'),
});

router.post('/criar', requireAuth, validate({ body: schemaCriar }), ctrl.criar);
router.get(
  '/:id/status',
  requireAuth,
  validate({ params: z.object({ id: z.coerce.number().int().min(1) }) }),
  ctrl.status
);
router.post(
  '/:id/simular-aprovacao',
  requireAuth,
  validate({ params: z.object({ id: z.coerce.number().int().min(1) }) }),
  ctrl.simularAprovacao
);

// Webhook do provedor (sem auth de usuário — autenticado por assinatura).
router.post('/webhooks/pix', ctrl.webhook);

module.exports = router;
