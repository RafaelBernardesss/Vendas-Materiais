const archiver = require('archiver');
const prisma = require('../lib/prisma');
const { ApiError } = require('../lib/errors');
const { resolverCaminho } = require('../lib/arquivos');

/** Garante que o usuário tem uma compra paga do material. */
async function verificarCompra(userId, materialId) {
  const item = await prisma.orderItem.findFirst({
    where: {
      materialId,
      status: 'PAID',
      order: { userId, status: 'PAID' },
    },
  });
  if (!item) throw ApiError.forbidden('Você não tem acesso a este material.');
  return item;
}

/** GET /api/downloads/meus — materiais comprados + arquivos. */
async function meus(req, res, next) {
  try {
    const pedidos = await prisma.order.findMany({
      where: { userId: req.user.id, status: 'PAID' },
      include: {
        itens: {
          include: {
            material: {
              select: {
                id: true,
                titulo: true,
                preco: true,
                arquivoCapa: true,
                arquivos: { select: { id: true, nomeArquivo: true, tamanho: true, tipo: true } },
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    const materiais = pedidos.flatMap((p) =>
      p.itens.map((i) => ({
        material: {
          id: i.material.id,
          titulo: i.material.titulo,
          preco: i.material.preco,
          capa: i.material.arquivoCapa ? `/api/materiais/capa/${i.material.id}` : null,
        },
        arquivos: i.material.arquivos,
        compradoEm: p.paidAt,
        pedidoId: p.id,
      }))
    );

    res.json({ materiais });
  } catch (err) {
    next(err);
  }
}

/** GET /api/downloads/arquivo/:fileId — download protegido de um arquivo. */
async function baixarArquivo(req, res, next) {
  try {
    const arquivo = await prisma.materialFile.findUnique({ where: { id: Number(req.params.fileId) } });
    if (!arquivo) throw ApiError.notFound('Arquivo não encontrado.');

    await verificarCompra(req.user.id, arquivo.materialId);

    const absoluto = resolverCaminho(arquivo.caminhoRelativo);
    res.download(absoluto, arquivo.nomeArquivo);
  } catch (err) {
    next(err);
  }
}

/** GET /api/downloads/material/:materialId — todos os arquivos em um .zip. */
async function baixarZip(req, res, next) {
  try {
    const materialId = Number(req.params.materialId);
    await verificarCompra(req.user.id, materialId);

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: { arquivos: true },
    });
    if (!material) throw ApiError.notFound('Material não encontrado.');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="material-${materialId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ message: 'Falha ao gerar o ZIP.' });
      else res.destroy(err);
    });
    res.on('close', () => {
      try {
        archive.abort();
      } catch {
        /* já finalizado */
      }
    });

    archive.pipe(res);
    for (const f of material.arquivos) {
      try {
        const absoluto = resolverCaminho(f.caminhoRelativo);
        archive.file(absoluto, { name: f.nomeArquivo });
      } catch {
        // arquivo ausente no disco: segue com os demais
      }
    }
    await archive.finalize();
  } catch (err) {
    next(err);
  }
}

module.exports = { meus, baixarArquivo, baixarZip };
