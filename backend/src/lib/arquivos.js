const fs = require('fs');
const path = require('path');
const env = require('./env');
const { ApiError } = require('./errors');

/**
 * Resolve um caminho relativo (armazenado no banco) dentro de UPLOAD_DIR.
 * Protege contra path traversal: o caminho final precisa permanecer
 * dentro da pasta de uploads e o arquivo precisa existir.
 */
function resolverCaminho(caminhoRelativo) {
  const base = path.resolve(env.UPLOAD_DIR);
  const absoluto = path.resolve(base, caminhoRelativo || '');
  if (absoluto === base || !absoluto.startsWith(base + path.sep)) {
    throw ApiError.badRequest('Caminho de arquivo inválido.');
  }
  if (!fs.existsSync(absoluto)) {
    throw ApiError.notFound('Arquivo não está mais disponível.');
  }
  return absoluto;
}

/** Remove um arquivo do disco (melhor esforço, nunca lança). */
function removerDoDisco(caminhoRelativo) {
  try {
    const base = path.resolve(env.UPLOAD_DIR);
    const absoluto = path.resolve(base, caminhoRelativo || '');
    if (absoluto.startsWith(base + path.sep) && fs.existsSync(absoluto)) {
      fs.unlinkSync(absoluto);
    }
  } catch (err) {
    console.warn('[arquivos] Falha ao remover arquivo do disco:', err.message);
  }
}

module.exports = { resolverCaminho, removerDoDisco };
