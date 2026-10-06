const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
};

/** Limite de tentativas de login por IP (15 min / 20). */
const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

/** Limite de cadastros por IP (15 min / 5). */
const cadastroLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
});

/** Limite de comentários por IP (10 min / 15). */
const comentarioLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 15,
});

module.exports = { loginLimiter, cadastroLimiter, comentarioLimiter };
