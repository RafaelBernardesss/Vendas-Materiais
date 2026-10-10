require('./lib/env'); // carrega o .env antes de qualquer outro módulo

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./lib/env');
const { notFoundApi, errorHandler } = require('./middlewares/errorHandler');

// ---------- Validação do modo de pagamento ----------
// Valores aceitos: "mock" (simulação) ou "mp" (Mercado Pago).
// Qualquer outro valor (ex.: "live", "production") cairia silenciosamente na simulação.
const MODOS_VALIDOS = ['mock', 'mp'];
if (!MODOS_VALIDOS.includes(env.PAYMENT_MODE)) {
  console.error(
    `PAYMENT_MODE="${env.PAYMENT_MODE}" é inválido. Use "mock" (simulação) ou "mp" (Mercado Pago).`
  );
  process.exit(1);
}

if (env.PAYMENT_MODE === 'mp') {
  const faltando = [];
  if (!env.MP_ACCESS_TOKEN) faltando.push('MP_ACCESS_TOKEN');
  if (!env.MP_WEBHOOK_SECRET) faltando.push('MP_WEBHOOK_SECRET');
  if (faltando.length) {
    console.error(`PAYMENT_MODE=mp exige as variáveis: ${faltando.join(', ')}. Preencha o .env.`);
    process.exit(1);
  }
}

const app = express();
app.disable('x-powered-by');

// Atrás de proxy/HTTPS (Render, Railway, Nginx...) o Express precisa confiar no proxy,
// senão cookies "secure" não são enviados e o IP/protocolo chegam errados.
// Também vale para túneis (Cloudflare/ngrok): PUBLIC_URL https => há um proxy na frente
// enviando X-Forwarded-For (sem isso o express-rate-limit dá ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
if (env.COOKIE_SECURE === true || env.COOKIE_SECURE === 'true' || /^https:\/\//i.test(env.PUBLIC_URL || '')) {
  app.set('trust proxy', 1);
}

// ---------- Middlewares globais ----------
app.use(
  helmet({
    contentSecurityPolicy: false, // o front carrega Google Fonts externas
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer-when-downgrade' },
  })
);
app.use(
  cors({
    origin: [env.PUBLIC_URL, env.FRONTEND_URL].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---------- Healthcheck ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'slidehub-api', timestamp: new Date().toISOString() });
});

// ---------- Rotas da API ----------
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/materiais', require('./routes/materiais.routes'));
app.use('/api/carrinho', require('./routes/carrinho.routes'));
app.use('/api/pagamentos', require('./routes/pagamentos.routes'));
app.use('/api/downloads', require('./routes/downloads.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// ---------- Front-end (build do Vite) ----------
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const paginas = {
  '/': 'index.html',
  '/login': 'login.html',
  '/cadastro': 'cadastro.html',
  '/carrinho': 'carrinho.html',
  '/checkout': 'checkout.html',
  '/produto': 'produto.html',
  '/meus-materiais': 'meus-materiais.html',
  '/admin': 'admin.html',
};

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  for (const [rota, arquivo] of Object.entries(paginas)) {
    app.get(rota, (req, res) => res.sendFile(path.join(dist, arquivo)));
  }
} else {
  app.get('/', (req, res) =>
    res.type('text/plain; charset=utf-8').send('Frontend nao construido. Rode: npm run build')
  );
}

// ---------- 404 + erros ----------
app.use(notFoundApi);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`SlideHub API em http://localhost:${env.PORT}`);

  if (env.PAYMENT_MODE === 'mp') {
    const t = env.MP_ACCESS_TOKEN;
    const teste = t.startsWith('TEST-');
    console.log(
      `Modo de pagamento: MERCADO PAGO (${teste ? 'credenciais de TESTE' : 'PRODUCAO'})`
    );
    console.log(`MP_ACCESS_TOKEN carregado (${t.slice(0, 8)}…, ${t.length} caracteres)`);
    console.log('MP_WEBHOOK_SECRET carregado.');
    // Mesma montagem usada em services/pix.js (sem barra duplicada).
    console.log(
      `Webhook esperado em: ${String(env.PUBLIC_URL).replace(/\/+$/, '')}/api/pagamentos/webhooks/pix`
    );
    if (!/^https:\/\//i.test(env.PUBLIC_URL || '')) {
      console.warn(
        'PUBLIC_URL nao e HTTPS publico: o Mercado Pago nao consegue chamar o webhook (a confirmacao fica so pela consulta do checkout). Use um tunel (cloudflared/ngrok) ou o dominio publico com HTTPS.'
      );
    }
  } else {
    console.log(
      'Modo de pagamento: SIMULACAO (PAYMENT_MODE=mock) — use o botao "Simular pagamento aprovado" no checkout'
    );
  }
});

module.exports = app;
