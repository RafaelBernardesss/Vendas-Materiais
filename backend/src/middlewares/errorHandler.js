/** 404 para rotas de API. */
function notFoundApi(req, res, next) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Rota não encontrada.' });
  }
  next();
}

/** Tratamento centralizado de erros — nunca vaza stack trace ou caminhos internos. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Erro interno do servidor.';

  if (err && err.isApiError) {
    status = err.status || 500;
    message = err.message || message;
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    message = 'JSON inválido no corpo da requisição.';
  } else if (err && err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `O arquivo excede o tamanho máximo permitido (${Math.ceil(err.limit / 1024 / 1024)} MB).`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Máximo de 20 arquivos por material.';
    } else {
      message = 'Falha no upload do arquivo.';
    }
  } else if (err && err.code === 'P2002') {
    status = 409;
    message = 'Registro já existe.';
  } else if (err && err.code === 'P2025') {
    status = 404;
    message = 'Registro não encontrado.';
  } else if (err && err.code === 'P2076' && err.meta && err.meta.modelName === 'Material') {
    status = 409;
    message = 'Este material possui vendas registradas e não pode ser excluído.';
  }

  if (status >= 500) console.error('[erro]', err);
  res.status(status).json({ message });
}

module.exports = { notFoundApi, errorHandler };
