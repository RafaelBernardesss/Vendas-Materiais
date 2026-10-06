const prisma = require('../lib/prisma');
const { ApiError } = require('../lib/errors');

/** GET /api/carrinho */
async function listar(req, res, next) {
  try {
    const itens = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        material: { select: { id: true, titulo: true, preco: true, arquivoCapa: true, arquivos: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!itens.length) return res.json({ itens: [], total: 0 });

    const total = Number(itens.reduce((s, i) => s + i.material.preco, 0).toFixed(2));
    res.json({
      itens: itens.map((i) => ({
        materialId: i.materialId,
        titulo: i.material.titulo,
        preco: i.material.preco,
        capa: i.material.arquivoCapa ? `/api/materiais/capa/${i.materialId}` : null,
        nArquivos: i.material.arquivos.length,
      })),
      total,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/carrinho { materialId } */
async function adicionar(req, res, next) {
  try {
    const materialId = Number(req.body.materialId);
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw ApiError.notFound('Material não encontrado.');

    const jaComprou = await prisma.orderItem.findFirst({
      where: {
        materialId: material.id,
        status: 'PAID',
        order: { userId: req.user.id, status: 'PAID' },
      },
    });
    if (jaComprou) throw ApiError.conflict('Você já comprou este material. Baixe em "Meus materiais".');

    await prisma.cartItem.upsert({
      where: { userId_materialId: { userId: req.user.id, materialId: material.id } },
      update: {},
      create: { userId: req.user.id, materialId: material.id },
    });

    const totalItens = await prisma.cartItem.count({ where: { userId: req.user.id } });
    res.status(201).json({ ok: true, totalItens });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/carrinho/:materialId */
async function remover(req, res, next) {
  try {
    const materialId = Number(req.params.materialId);
    const del = await prisma.cartItem.deleteMany({
      where: { userId: req.user.id, materialId },
    });
    if (!del.count) throw ApiError.notFound('Este item não está no seu carrinho.');

    const totalItens = await prisma.cartItem.count({ where: { userId: req.user.id } });
    res.json({ ok: true, totalItens });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, adicionar, remover };
