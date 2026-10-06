const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
};

const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

const cadastroLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
});


const comentarioLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 15,
});

module.exports = { loginLimiter, cadastroLimiter, comentarioLimiter };
