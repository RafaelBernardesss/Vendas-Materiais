require('./lib/env'); // carrega o .env antes de qualquer outro módulo

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./lib/env');
const { notFoundApi, errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');

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
  console.log(
    `Modo de pagamento: ${
      env.PAYMENT_MODE === 'mp'
        ? 'MERCADO PAGO (producao)'
        : 'SIMULACAO (PAYMENT_MODE=mock) — use a botao "Simular pagamento aprovado" no checkout'
    }`
  );
});

module.exports = app;
