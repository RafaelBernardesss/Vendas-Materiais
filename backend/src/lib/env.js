const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * O app usa SEMPRE SQLite. Aceita DATABASE_URL externa apenas quando
 * aponta para arquivo file: (ex.: file:/home/usuario/slidehub.db).
 * URLs de outros bancos (injetadas por plataformas) são ignoradas.
 */
function resolverDatabaseUrl() {
  const u = process.env.DATABASE_URL;
  if (u && u.startsWith('file:')) return u;
  return 'file:./dev.db';
}

// Normaliza ANTES de qualquer PrismaClient ser criado (o client lê
// process.env.DATABASE_URL diretamente).
process.env.DATABASE_URL = resolverDatabaseUrl();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'troque-este-segredo-em-producao',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@slidehub.com').toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@1234',
  PAYMENT_MODE: (process.env.PAYMENT_MODE || 'mock').toLowerCase(),
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || '',
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
  PUBLIC_URL: process.env.PUBLIC_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  UPLOAD_DIR: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', '..', 'uploads'),
  UPLOAD_MAX_SIZE_MB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '25', 10),
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'troque-este-segredo-em-producao') {
  console.warn('[env] ATENCAO: defina um JWT_SECRET forte antes de entrar em producao.');
}

module.exports = env;
