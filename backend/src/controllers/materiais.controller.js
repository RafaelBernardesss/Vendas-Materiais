const prisma = require('../lib/prisma');
const { ApiError } = require('../lib/errors');
const { resolverCaminho } = require('../lib/arquivos');
const { resumoNotas, usuarioComprou } = require('../lib/avaliacoes');

/** Envia uma imagem pública com cabeçalhos que impedem execução de scripts. */
function enviarImagem(res, absoluto) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.sendFile(absoluto);
}

function tipoDe(arquivos) {
  const temPptx = arquivos.some((a) => a.tipo === 'PPTX');
  const temImagem = arquivos.some((a) => a.tipo === 'IMAGEM');
  return temPptx && temImagem ? 'MISTO' : temPptx ? 'POWERPOINT' : 'IMAGENS';
}

/**
 * GET /api/materiais
 * Vitrine pública. Para usuários logados retorna, por material:
 * noCarrinho (está no carrinho) e comprado (pagamento confirmado).
 * Inclui a média e o total de avaliações de cada material.
 */
async function listar(req, res, next) {
  try {
    const [materiais, notas] = await Promise.all([
      prisma.material.findMany({
        orderBy: { createdAt: 'desc' },
        include: { arquivos: { select: { id: true, tipo: true } } },
      }),
      prisma.avaliacao.groupBy({
        by: ['materialId'],
        _avg: { nota: true },
        _count: { _all: true },
      }),
    ]);
    const notaPorMaterial = new Map(notas.map((n) => [n.materialId, n]));

    const carrinho = new Set();
    const comprados = new Set();
    if (req.user) {
      const [itensCarrinho, pedidosPagos] = await Promise.all([
        prisma.cartItem.findMany({
          where: { userId: req.user.id },
          select: { materialId: true },
        }),
        prisma.orderItem.findMany({
          where: {
            status: 'PAID',
            order: { userId: req.user.id, status: 'PAID' },
          },
          select: { materialId: true },
        }),
      ]);
      itensCarrinho.forEach((i) => carrinho.add(i.materialId));
      pedidosPagos.forEach((p) => comprados.add(p.materialId));
    }

    res.json({
      materiais: materiais.map((m) => {
        const n = notaPorMaterial.get(m.id);
        return {
          id: m.id,
          titulo: m.titulo,
          descricao: m.descricao,
          preco: m.preco,
          capa: m.arquivoCapa ? `/api/materiais/capa/${m.id}` : null,
          tipo: tipoDe(m.arquivos),
          nArquivos: m.arquivos.length,
          arquivoId: m.arquivos.length === 1 ? m.arquivos[0].id : null,
          noCarrinho: carrinho.has(m.id),
          comprado: comprados.has(m.id),
          media: n ? Math.round(n._avg.nota * 10) / 10 : 0,
          totalAvaliacoes: n ? n._count._all : 0,
          createdAt: m.createdAt,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/materiais/:id — página de detalhes do produto. */
async function detalhe(req, res, next) {
  try {
    const id = Number(req.params.id);
    const m = await prisma.material.findUnique({
      where: { id },
      include: {
        arquivos: { select: { id: true, tipo: true, nomeArquivo: true, tamanho: true } },
        fotos: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }], select: { id: true } },
      },
    });
    if (!m) throw ApiError.notFound('Material não encontrado.');

    let noCarrinho = false;
    let comprado = false;
    let minhaNota = 0;
    if (req.user) {
      const [item, compra, aval] = await Promise.all([
        prisma.cartItem.findUnique({
          where: { userId_materialId: { userId: req.user.id, materialId: id } },
          select: { id: true },
        }),
        usuarioComprou(req.user.id, id),
        prisma.avaliacao.findUnique({
          where: { userId_materialId: { userId: req.user.id, materialId: id } },
          select: { nota: true },
        }),
      ]);
      noCarrinho = !!item;
      comprado = compra;
      minhaNota = aval ? aval.nota : 0;
    }

    // Galeria = fotos do anúncio; sem fotos, usa a capa (se existir).
    const capa = m.arquivoCapa ? `/api/materiais/capa/${m.id}` : null;
    const galeria = m.fotos.length ? m.fotos.map((f) => `/api/materiais/foto/${f.id}`) : capa ? [capa] : [];

    res.json({
      material: {
        id: m.id,
        titulo: m.titulo,
        descricao: m.descricao,
        preco: m.preco,
        capa,
        galeria,
        tipo: tipoDe(m.arquivos),
        // Mostra o que vem no pacote (nome/tipo/tamanho), nunca o caminho do arquivo.
        arquivos: m.arquivos.map((a) => ({ nomeArquivo: a.nomeArquivo, tipo: a.tipo, tamanho: a.tamanho })),
        arquivoId: m.arquivos.length === 1 ? m.arquivos[0].id : null,
        noCarrinho,
        comprado,
        minhaNota,
        avaliacoes: await resumoNotas(id),
        createdAt: m.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/materiais/capa/:id — imagem de capa (pré-visualização pública). */
async function capa(req, res, next) {
  try {
    const material = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
    if (!material || !material.arquivoCapa) throw ApiError.notFound('Capa não encontrada.');
    enviarImagem(res, resolverCaminho(material.arquivoCapa));
  } catch (err) {
    next(err);
  }
}

/** GET /api/materiais/foto/:fotoId — foto pública do anúncio. */
async function foto(req, res, next) {
  try {
    const f = await prisma.materialFoto.findUnique({ where: { id: Number(req.params.fotoId) } });
    if (!f) throw ApiError.notFound('Foto não encontrada.');
    enviarImagem(res, resolverCaminho(f.caminhoRelativo));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, detalhe, capa, foto };
