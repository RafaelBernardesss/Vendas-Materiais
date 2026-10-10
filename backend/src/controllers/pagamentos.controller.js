const crypto = require('crypto');
const prisma = require('../lib/prisma');
const env = require('../lib/env');
const { ApiError } = require('../lib/errors');
const pix = require('../services/pix');
const cpfSvc = require('../services/cpf');

/**
 * Confirma o pagamento de um pedido (IDEMPOTENTE):
 * - atualiza Order e OrderItems para PAID
 * - grava txid e paidAt
 * - limpa os itens comprados do carrinho do usuário
 * Se o pedido já estiver PAID, retorna sem alterar nada.
 */
async function confirmarPagamento(orderId, txid) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Pedido não encontrado.');
    if (order.status === 'PAID') return order; // idempotência

    const upd = await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID', paidAt: new Date(), txid: txid || order.txid },
    });
    await tx.orderItem.updateMany({ where: { orderId }, data: { status: 'PAID' } });

    const itens = await tx.orderItem.findMany({ where: { orderId }, select: { materialId: true } });
    if (itens.length) {
      await tx.cartItem.deleteMany({
        where: { userId: order.userId, materialId: { in: itens.map((i) => i.materialId) } },
      });
    }
    return upd;
  });
}

/** POST /api/pagamentos/criar { nomeCompleto, cpf } */
async function criar(req, res, next) {
  try {
    const { nomeCompleto, cpf } = req.body;

    const itens = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { material: { select: { id: true, preco: true } } },
    });
    if (!itens.length) throw ApiError.badRequest('Seu carrinho está vazio.');

    // Cancela pedidos pendentes anteriores do usuário (um por vez).
    await prisma.$transaction([
      prisma.orderItem.updateMany({
        where: { order: { userId: req.user.id, status: 'PENDING' } },
        data: { status: 'CANCELED' },
      }),
      prisma.order.updateMany({
        where: { userId: req.user.id, status: 'PENDING' },
        data: { status: 'CANCELED' },
      }),
    ]);

    const total = Number(itens.reduce((s, i) => s + i.material.preco, 0).toFixed(2));

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        status: 'PENDING',
        total,
        nomeCompleto,
        cpf: cpfSvc.soDigitos(cpf),
        itens: {
          create: itens.map((i) => ({
            materialId: i.material.id,
            preco: i.material.preco,
            status: 'PENDING',
          })),
        },
      },
    });

    const pixInfo = await pix.criarPagamentoPix({
      orderId: order.id,
      valor: total,
      email: req.user.email,
      nome: nomeCompleto,
      cpf: cpfSvc.soDigitos(cpf),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { providerPaymentId: pixInfo.providerPaymentId, txid: pixInfo.txid },
    });

    if (pixInfo.status === 'PAID') {
      await confirmarPagamento(order.id, pixInfo.txid);
    }

    res.status(201).json({
      orderId: order.id,
      status: pixInfo.status === 'PAID' ? 'PAID' : 'PENDING',
      qrCode: pixInfo.qrCode,
      expiresAt: pixInfo.expiresAt,
      mock: env.PAYMENT_MODE !== 'mp',
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/pagamentos/:id/status (polling do front) */
async function status(req, res, next) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    if (!order) throw ApiError.notFound('Pedido não encontrado.');

    if (order.status === 'PENDING') {
      const remoto = await pix.statusNoProvedor(order.providerPaymentId);
      if (pix.pagamentoConfere(order, remoto)) {
        await confirmarPagamento(order.id, remoto.txid);
      }
    }

    const atual = await prisma.order.findUnique({ where: { id: order.id } });
    res.json({ status: atual.status, paidAt: atual.paidAt });
  } catch (err) {
    next(err);
  }
}

/** POST /api/pagamentos/:id/simular-aprovacao — apenas em PAYMENT_MODE=mock */
async function simularAprovacao(req, res, next) {
  try {
    if (env.PAYMENT_MODE !== 'mock') {
      throw ApiError.badRequest('Simulação de pagamento disponível apenas com PAYMENT_MODE=mock.');
    }
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
    if (!order) throw ApiError.notFound('Pedido não encontrado.');
    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw ApiError.forbidden('Você não pode acessar este pedido.');
    }
    if (order.status === 'PAID') return res.json({ status: 'PAID', idempotente: true });

    const txid = `SIM-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const upd = await confirmarPagamento(order.id, txid);
    res.json({ status: upd.status, txid: upd.txid });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/pagamentos/webhooks/pix
 * Webhook do Mercado Pago — confirmação automática.
 * - valida a assinatura (x-signature) quando em modo mp
 * - idempotente: pedidos já PAID são respondidos sem reprocessar
 */
async function webhook(req, res) {
  try {
    if (env.PAYMENT_MODE === 'mp') {
      if (!pix.validarAssinaturaMp(req)) {
        return res.status(401).json({ message: 'Assinatura inválida.' });
      }
    }

    // Só interessam notificações de pagamento (o MP também avisa outros tópicos).
    const tipo = (req.body && (req.body.type || req.body.topic)) || req.query.type || 'payment';
    if (tipo !== 'payment') return res.json({ ok: true, ignorado: true });

    const providerId = pix.idDaNotificacao(req);
    if (!providerId) return res.json({ ok: true, ignorado: true });

    const order = await prisma.order.findFirst({
      where: { providerPaymentId: providerId },
    });
    if (!order) return res.json({ ok: true, ignorado: true });
    if (order.status === 'PAID') return res.json({ ok: true, idempotente: true });

    // Nunca confie no corpo do webhook: confirme consultando o provedor.
    const remoto = await pix.statusNoProvedor(providerId);
    if (pix.pagamentoConfere(order, remoto)) {
      await confirmarPagamento(order.id, remoto.txid);
      return res.json({ ok: true, confirmado: true });
    }

    res.json({ ok: true, status: order.status });
  } catch (err) {
    console.error('[webhook]', err);
    res.status(500).json({ message: 'Erro ao processar webhook.' });
  }
}

module.exports = { criar, status, simularAprovacao, webhook };
