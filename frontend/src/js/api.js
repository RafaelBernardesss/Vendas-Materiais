/** Cliente HTTP mínimo com cookies (same-origin) e mensagens do servidor. */

async function request(caminho, { method = 'GET', body, isForm = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData — o navegador define o Content-Type
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(caminho, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* resposta sem JSON */
  }

  if (!res.ok) {
    const mensagem =
      (data && (data.message || data.error)) ||
      (res.status === 401 ? 'Faça login para continuar.' : `Erro ${res.status}`);
    const err = new Error(mensagem);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (c) => request(c),
  post: (c, body) => request(c, { method: 'POST', body }),
  put: (c, body) => request(c, { method: 'PUT', body }),
  del: (c) => request(c, { method: 'DELETE' }),
  postForm: (c, form) => request(c, { method: 'POST', body: form, isForm: true }),
};
