const path = require('path');
const prisma = require('../lib/prisma');
const { ApiError } = require('../lib/errors');
const { removerDoDisco } = require('../lib/arquivos');
const { EXT, IMG_EXT } = require('../middlewares/upload');

function extDe(nomeArquivo) {
  return path.extname(nomeArquivo || '').toLowerCase().replace('.', '');
}

/** GET /api/admin/materiais — lista com quantidade de vendas. */
async function listar(req, res, next) {
  try {
    const materiais = await prisma.material.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        arquivos: { select: { id: true, tipo: true, nomeArquivo: true } },
        fotos: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }], select: { id: true } },
        _count: { select: { pedidos: { where: { status: 'PAID' } } } },
      },
    });

    res.json({
      materiais: materiais.map((m) => ({
        id: m.id,
        titulo: m.titulo,
        preco: m.preco,
        descricao: m.descricao,
        capa: m.arquivoCapa ? `/api/materiais/capa/${m.id}` : null,
        createdAt: m.createdAt,
        vendas: m._count.pedidos,
        nArquivos: m.arquivos.length,
        fotos: m.fotos.map((f) => ({ id: f.id, url: `/api/materiais/foto/${f.id}` })),
        tipos: [...new Set(m.arquivos.map((a) => a.tipo))],
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** Remove do disco todos os arquivos enviados numa requisição que falhou. */
function limparUploads(req) {
  const grupos = req.files && !Array.isArray(req.files) ? Object.values(req.files).flat() : req.files || [];
  grupos.forEach((f) => removerDoDisco(path.join('arquivos', path.basename(f.path))));
}

const relativo = (f) => path.join('arquivos', path.basename(f.path));

/**
 * POST /api/admin/materiais (multipart/form-data)
 * Campos: titulo, preco, descricao (opcional),
 *   arquivos[] (o que o cliente recebe) e fotos[] (fotos do anúncio, opcional).
 * Capa: a primeira foto do anúncio; sem fotos, a primeira imagem dos arquivos.
 */
async function publicar(req, res, next) {
  try {
    const { titulo, preco, descricao } = req.body;
    const arquivos = (req.files && req.files.arquivos) || [];
    const fotos = (req.files && req.files.fotos) || [];

    if (!titulo || String(titulo).trim().length < 2) throw ApiError.badRequest('Informe o título do material.');
    if (!arquivos.length) {
      throw ApiError.badRequest('Adicione pelo menos um arquivo (PowerPoint ou imagem).');
    }

    const precoNum = Number(String(preco).replace(',', '.'));
    if (!Number.isFinite(precoNum) || precoNum <= 0) {
      throw ApiError.badRequest('Informe um preço válido maior que zero.');
    }

    const imagemDosArquivos = arquivos.find((f) => IMG_EXT.has(extDe(f.originalname)));
    const capaFile = fotos[0] || imagemDosArquivos;

    const material = await prisma.material.create({
      data: {
        titulo: String(titulo).trim(),
        preco: Number(precoNum.toFixed(2)),
        descricao: descricao ? String(descricao).trim() : null,
        arquivoCapa: capaFile ? relativo(capaFile) : null,
        arquivos: {
          create: arquivos.map((f) => {
            const ext = extDe(f.originalname);
            return {
              nomeArquivo: f.originalname,
              caminhoRelativo: relativo(f),
              tipo: ext === 'ppt' || ext === 'pptx' ? 'PPTX' : 'IMAGEM',
              tamanho: f.size,
              mime: EXT[ext] || f.mimetype || null,
            };
          }),
        },
        fotos: { create: fotos.map((f, i) => ({ caminhoRelativo: relativo(f), ordem: i })) },
      },
    });

    res.status(201).json({ id: material.id, mensagem: 'Material publicado com sucesso!' });
  } catch (err) {
    limparUploads(req);
    next(err);
  }
}

/** POST /api/admin/materiais/:id/fotos (multipart: fotos[]) — adiciona fotos ao anúncio. */
async function adicionarFotos(req, res, next) {
  try {
    const id = Number(req.params.id);
    const fotos = req.files || [];
    if (!fotos.length) throw ApiError.badRequest('Selecione pelo menos uma foto.');

    const material = await prisma.material.findUnique({
      where: { id },
      include: { _count: { select: { fotos: true } } },
    });
    if (!material) throw ApiError.notFound('Material não encontrado.');

    const ultima = await prisma.materialFoto.findFirst({ where: { materialId: id }, orderBy: { ordem: 'desc' } });
    const inicio = ultima ? ultima.ordem + 1 : 0;

    await prisma.materialFoto.createMany({
      data: fotos.map((f, i) => ({ materialId: id, caminhoRelativo: relativo(f), ordem: inicio + i })),
    });
    // Primeira foto do anúncio passa a ser a capa.
    if (material._count.fotos === 0) {
      await prisma.material.update({ where: { id }, data: { arquivoCapa: relativo(fotos[0]) } });
    }
    res.status(201).json({ ok: true, mensagem: 'Fotos adicionadas.' });
  } catch (err) {
    limparUploads(req);
    next(err);
  }
}

/** DELETE /api/admin/fotos/:fotoId — remove uma foto do anúncio. */
async function removerFoto(req, res, next) {
  try {
    const foto = await prisma.materialFoto.findUnique({
      where: { id: Number(req.params.fotoId) },
      include: { material: { include: { arquivos: true } } },
    });
    if (!foto) throw ApiError.notFound('Foto não encontrada.');

    await prisma.materialFoto.delete({ where: { id: foto.id } });
    removerDoDisco(foto.caminhoRelativo);

    // Se era a capa, escolhe outra: próxima foto, senão a primeira imagem dos arquivos.
    if (foto.material.arquivoCapa === foto.caminhoRelativo) {
      const proxima = await prisma.materialFoto.findFirst({
        where: { materialId: foto.materialId },
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      });
      const img = foto.material.arquivos.find((a) => a.tipo === 'IMAGEM');
      await prisma.material.update({
        where: { id: foto.materialId },
        data: { arquivoCapa: proxima ? proxima.caminhoRelativo : img ? img.caminhoRelativo : null },
      });
    }
    res.json({ ok: true, mensagem: 'Foto removida.' });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/materiais/:id { titulo?, preco?, descricao? } */
async function editar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { titulo, preco, descricao } = req.body;
    const dados = {};

    if (titulo !== undefined) {
      const t = String(titulo).trim();
      if (t.length < 2) throw ApiError.badRequest('Título muito curto.');
      dados.titulo = t;
    }
    if (preco !== undefined) {
      const p = Number(String(preco).replace(',', '.'));
      if (!Number.isFinite(p) || p <= 0) throw ApiError.badRequest('Preço inválido.');
      dados.preco = Number(p.toFixed(2));
    }
    if (descricao !== undefined) {
      dados.descricao = descricao ? String(descricao).trim() : null;
    }
    if (!Object.keys(dados).length) throw ApiError.badRequest('Nada para atualizar.');

    const material = await prisma.material.update({ where: { id }, data: dados });
    res.json({ ok: true, id: material.id, mensagem: 'Material atualizado.' });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/materiais/:id */
async function excluir(req, res, next) {
  try {
    const id = Number(req.params.id);
    const material = await prisma.material.findUnique({
      where: { id },
      include: { arquivos: true, fotos: true },
    });
    if (!material) throw ApiError.notFound('Material não encontrado.');

    const caminhos = new Set(material.arquivos.map((a) => a.caminhoRelativo));
    material.fotos.forEach((f) => caminhos.add(f.caminhoRelativo));
    if (material.arquivoCapa) caminhos.add(material.arquivoCapa);
    caminhos.forEach(removerDoDisco);

    await prisma.material.delete({ where: { id } });
    res.json({ ok: true, mensagem: 'Material excluído.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, publicar, adicionarFotos, removerFoto, editar, excluir };
