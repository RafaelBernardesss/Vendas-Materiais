const crypto = require('crypto');
const env = require('../lib/env');
const { ApiError } = require('../lib/errors');

const VALIDADE_MIN = 30; // minutos

/**
 * Cria um pagamento Pix.
 * - PAYMENT_MODE=mock  -> gera um QR/BR-code fictício (testes sem credenciais)
 * - PAYMENT_MODE=mp    -> cria pagamento real no Mercado Pago
 * Retorna { providerPaymentId, txid, qrCode, qrCodeBase64, status, expiresAt }
 */
async function criarPagamentoPix({ orderId, valor, email, nome }) {
  if (env.PAYMENT_MODE !== 'mp') {
    const txid = `MOCK-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const qrCode =
      `00020126580014BR.GOV.BCB.PIX0136${txid}52040000` +
      `53039865406${valor.toFixed(2)}5802BR5909SLIDEHUB` +
      `6009SAO PAULO62140510${crypto.randomBytes(5).toString('hex')}6304ABCD`;
    return {
      providerPaymentId: `mock-${orderId}`,
      txid,
      qrCode,
      qrCodeBase64: null,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + VALIDADE_MIN * 60 * 1000),
    };
  }

  // ---------- Mercado Pago (produção) ----------
  if (!env.MP_ACCESS_TOKEN) {
    throw ApiError.badRequest(
      'Pagamento real indisponível: configure MP_ACCESS_TOKEN e defina PAYMENT_MODE=mp no servidor.'
    );
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: Number(valor.toFixed(2)),
      description: 'SlideHub - materiais digitais',
      payment_method_id: 'pix',
      payer: { email, first_name: nome || 'Cliente' },
      point_of_interaction: { transaction_mode: 'online' },
      external_reference: String(orderId),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw ApiError.badRequest(data.message || 'Falha ao gerar o Pix no provedor de pagamento.');
  }

  const check = (data.point_of_interaction && data.point_of_interaction.data && data.point_of_interaction.data.check_data) || {};
  return {
    providerPaymentId: String(data.id),
    txid: check.txid || null,
    qrCode: check.qr_code || null,
    qrCodeBase64: check.qr_code_base64 || null,
    status: data.status === 'approved' ? 'PAID' : 'PENDING',
    expiresAt: check.qr_code_expiration
      ? new Date(check.qr_code_expiration)
      : new Date(Date.now() + VALIDADE_MIN * 60 * 1000),
  };
}

/** Consulta o status do pagamento no provedor (null em modo mock). */
async function statusNoProvedor(providerPaymentId) {
  if (env.PAYMENT_MODE !== 'mp' || !providerPaymentId || providerPaymentId.startsWith('mock-')) {
    return null;
  }
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txid =
      (data.point_of_interaction &&
        data.point_of_interaction.transaction_data &&
        data.point_of_interaction.transaction_data.txid) ||
      null;
    return { status: data.status, txid };
  } catch {
    return null;
  }
}

/**
 * Valida a assinatura do webhook do Mercado Pago (header x-signature).
 * Formato: ts=<timestamp>,v1=<hmac-sha256>. O payload assinado é
 * `${id}:${ts}:${v1}` (quando o body tem id) ou `${ts}:${v1}`.
 */
function validarAssinaturaMp(req) {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = req.get('x-signature') || '';
  const partes = {};
  header.split(',').forEach((par) => {
    const [k, v] = par.trim().split('=');
    if (k && v) partes[k] = v;
  });
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const id = req.body && req.body.id;
  const payload = id ? `${id}:${ts}:${v1}` : `${ts}:${v1}`;
  const esperado = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { criarPagamentoPix, statusNoProvedor, validarAssinaturaMp };
