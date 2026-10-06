const prisma = require('../lib/prisma');
const { ApiError } = require('../lib/errors');
const { resumoNotas, usuarioComprou } = require('../lib/avaliacoes');

async function garantirMaterial(id) {
  const m = await prisma.material.findUnique({ where: { id }, select: { id: true } });
  if (!m) throw ApiError.notFound('Material não encontrado.');
}

/** Mostra só o primeiro nome + inicial do sobrenome (privacidade). */
function nomePublico(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1][0]}.` : partes[0] || 'Cliente';
}

/** GET /api/materiais/:id/comentarios */
async function listarComentarios(req, res, next) {
  try {
    const materialId = Number(req.params.id);
    await garantirMaterial(materialId);

    const comentarios = await prisma.comentario.findMany({
      where: { materialId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, nome: true, role: true } } },
    });

    const ids = [...new Set(comentarios.map((c) => c.userId))];
    const [compras, notas] = await Promise.all([
      prisma.orderItem.findMany({
        where: { materialId, status: 'PAID', order: { status: 'PAID', userId: { in: ids } } },
        select: { order: { select: { userId: true } } },
      }),
      prisma.avaliacao.findMany({ where: { materialId, userId: { in: ids } }, select: { userId: true, nota: true } }),
    ]);
    const compradores = new Set(compras.map((c) => c.order.userId));
    const notaDe = new Map(notas.map((n) => [n.userId, n.nota]));

    res.json({
      comentarios: comentarios.map((c) => ({
        id: c.id,
        texto: c.texto,
        createdAt: c.createdAt,
        autor: c.user.role === 'ADMIN' ? 'Loja SlideHub' : nomePublico(c.user.nome),
        admin: c.user.role === 'ADMIN',
        compraVerificada: compradores.has(c.userId),
        nota: notaDe.get(c.userId) || null,
        meu: !!req.user && req.user.id === c.userId,
        podeExcluir: !!req.user && (req.user.id === c.userId || req.user.role === 'ADMIN'),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/materiais/:id/comentarios { texto } — qualquer usuário logado. */
async function criarComentario(req, res, next) {
  try {
    const materialId = Number(req.params.id);
    await garantirMaterial(materialId);
    const texto = String(req.body.texto || '').trim();
    if (texto.length < 3) throw ApiError.badRequest('Escreva pelo menos 3 caracteres.');
    if (texto.length > 1000) throw ApiError.badRequest('O comentário pode ter no máximo 1000 caracteres.');

    const c = await prisma.comentario.create({ data: { materialId, userId: req.user.id, texto } });
    res.status(201).json({ id: c.id, mensagem: 'Comentário publicado!' });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/materiais/comentarios/:comentarioId — autor ou admin. */
async function excluirComentario(req, res, next) {
  try {
    const c = await prisma.comentario.findUnique({ where: { id: Number(req.params.comentarioId) } });
    if (!c) throw ApiError.notFound('Comentário não encontrado.');
    if (c.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw ApiError.forbidden('Você só pode excluir os seus comentários.');
    }
    await prisma.comentario.delete({ where: { id: c.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/materiais/:id/avaliacao { nota: 1..5 } — somente quem comprou. */
async function avaliar(req, res, next) {
  try {
    const materialId = Number(req.params.id);
    await garantirMaterial(materialId);
    const nota = Number(req.body.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw ApiError.badRequest('A nota deve ser de 1 a 5.');

    if (!(await usuarioComprou(req.user.id, materialId))) {
      throw ApiError.forbidden('Somente quem comprou este material pode avaliá-lo.');
    }

    await prisma.avaliacao.upsert({
      where: { userId_materialId: { userId: req.user.id, materialId } },
      update: { nota },
      create: { userId: req.user.id, materialId, nota },
    });
    res.json({ ok: true, minhaNota: nota, avaliacoes: await resumoNotas(materialId) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarComentarios, criarComentario, excluirComentario, avaliar };
