const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const env = require('../lib/env');
const { ApiError } = require('../lib/errors');

const userPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  role: u.role,
  dataNascimento: u.dataNascimento,
});

function setCookie(res, user) {
  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/** POST /api/auth/cadastro */
async function cadastro(req, res, next) {
  try {
    const { nome, email, senha, dataNascimento } = req.body;

    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) throw ApiError.conflict('Este e-mail já está cadastrado. Faça login.');

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        dataNascimento: new Date(dataNascimento),
        role: 'USER',
      },
    });

    setCookie(res, user);
    res.status(201).json({ user: userPublico(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw ApiError.unauthorized('E-mail ou senha incorretos.');

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) throw ApiError.unauthorized('E-mail ou senha incorretos.');

    setCookie(res, user);
    res.json({ user: userPublico(user) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me */
async function me(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ user: null });

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return res.status(401).json({ user: null });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ user: null });

    res.json({ user: userPublico(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/sair */
async function sair(req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
}

module.exports = { cadastro, login, me, sair };
