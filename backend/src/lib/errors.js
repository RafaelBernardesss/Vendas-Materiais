/**
 * Erro de aplicação com status HTTP.
 * Nunca expõe detalhes internos — apenas a mensagem amigável.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isApiError = true;
  }

  static badRequest(message = 'Dados inválidos.') {
    return new ApiError(400, message);
  }
  static unauthorized(message = 'Não autenticado.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Acesso negado.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Não encontrado.') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Conflito de dados.') {
    return new ApiError(409, message);
  }
}

module.exports = { ApiError };
