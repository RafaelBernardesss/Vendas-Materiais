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
async function criarPagamentoPix({ orderId, valor, email, nome, cpf }) {
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

  // O Mercado Pago só aceita notification_url pública em HTTPS.
  const notificationUrl = /^https:\/\//i.test(env.PUBLIC_URL)
    ? `${env.PUBLIC_URL.replace(/\/+$/, '')}/api/pagamentos/webhooks/pix`
    : undefined;

  const partesNome = String(nome || 'Cliente').trim().split(/\s+/);
  const payer = {
    email,
    first_name: partesNome[0],
    last_name: partesNome.slice(1).join(' ') || undefined,
  };
  if (cpf) payer.identification = { type: 'CPF', number: String(cpf) };

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
      payer,
      external_reference: String(orderId),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Mostra a causa real no terminal do servidor (sem expor o token).
    console.error('[mp] erro ao criar pagamento:', res.status, JSON.stringify(data));
    const causa = Array.isArray(data.cause) && data.cause[0] && data.cause[0].description;
    throw ApiError.badRequest(
      causa || data.message || 'Falha ao gerar o Pix no provedor de pagamento.'
    );
  }

  // O QR Code vem em point_of_interaction.transaction_data (check_data fica como plano B).
  const poi = data.point_of_interaction || {};
  const tx = poi.transaction_data || (poi.data && poi.data.check_data) || {};
  if (!tx.qr_code) {
    console.error('[mp] resposta sem qr_code:', JSON.stringify(data));
    throw ApiError.badRequest('O Mercado Pago não retornou o código Pix. Tente novamente.');
  }

  return {
    providerPaymentId: String(data.id),
    txid: tx.txid || null,
    qrCode: tx.qr_code,
    qrCodeBase64: tx.qr_code_base64 || null,
    status: data.status === 'approved' ? 'PAID' : 'PENDING',
    expiresAt: data.date_of_expiration
      ? new Date(data.date_of_expiration)
      : new Date(Date.now() + 24 * 60 * 60 * 1000), // padrão do Pix no Mercado Pago: 24h
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
    return {
      status: data.status,
      txid,
      externalReference: data.external_reference != null ? String(data.external_reference) : null,
      amount: Number(data.transaction_amount),
    };
  } catch {
    return null;
  }
}

/** Id do recurso notificado: vem na query (?data.id=123); o body é plano B. */
function idDaNotificacao(req) {
  const doQuery = req.query && req.query['data.id'];
  const doBody = req.body && req.body.data && req.body.data.id;
  const id = doQuery || doBody || null;
  return id ? String(id) : null;
}

/**
 * Valida a assinatura do webhook do Mercado Pago (header x-signature).
 * Header: ts=<timestamp>,v1=<hmac>. Texto assinado (HMAC-SHA256 em hex, usando o
 * segredo do webhook como chave):
 *   id:<data.id da URL em minúsculas>;request-id:<header x-request-id>;ts:<ts>;
 * Partes ausentes (id ou request-id) saem do texto.
 */
function validarAssinaturaMp(req) {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = req.get('x-signature') || '';
  const partes = {};
  header.split(',').forEach((par) => {
    const i = par.indexOf('=');
    if (i > 0) partes[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  });
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const id = idDaNotificacao(req);
  const requestId = req.get('x-request-id');

  let manifest = '';
  if (id) manifest += `id:${id.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Confere se o pagamento do provedor é mesmo deste pedido (referência e valor). */
function pagamentoConfere(order, remoto) {
  if (!remoto || remoto.status !== 'approved') return false;
  if (remoto.externalReference !== String(order.id)) return false;
  return Math.abs(remoto.amount - Number(order.total)) < 0.01;
}

module.exports = {
  criarPagamentoPix,
  statusNoProvedor,
  validarAssinaturaMp,
  idDaNotificacao,
  pagamentoConfere,
};
