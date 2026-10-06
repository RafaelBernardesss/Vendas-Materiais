const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const env = require('../lib/env');
const { ApiError } = require('../lib/errors');

/**
 * Exige um usuário autenticado (JWT em cookie httpOnly "token").
 * Popula req.user com o usuário do banco.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) throw ApiError.unauthorized('Faça login para continuar.');

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Sessão expirada. Faça login novamente.');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw ApiError.unauthorized('Usuário não encontrado.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige role ADMIN (usar sempre depois de requireAuth). */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(ApiError.forbidden('Acesso restrito ao administrador.'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
