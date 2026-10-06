import { api } from './api.js';
import {
  state, renderHeader, renderFooter, loadUser, refreshCartCount, toast, emptyState,
  money, escapeHtml, dataBr, tamanhoBr, iniciais, showModal, stars, STAR_SVG_PATH,
  SPINNER, SVG_CART, SVG_DOWNLOAD,
} from './ui.js';

const root = document.getElementById('produto-root');
const id = Number(new URLSearchParams(location.search).get('id'));
const LABEL_TIPO = { POWERPOINT: 'PowerPoint', IMAGENS: 'Imagens', MISTO: 'PowerPoint + Imagens' };

let m = null; // material carregado
let fotoAtual = 0;

/* ---------------- Botão de ação (comprar / carrinho / download) ---------------- */
function botaoCompra() {
  if (m.comprado) {
    const href = m.arquivoId ? `/api/downloads/arquivo/${m.arquivoId}` : `/api/downloads/material/${m.id}`;
    return `<a class="btn btn-pix btn-lg btn-block" href="${href}">${SVG_DOWNLOAD}<span>Download</span></a>`;
  }
  if (m.noCarrinho) {
    return `<a class="btn btn-outline btn-lg btn-block" href="/carrinho">${SVG_CART}<span>No carrinho — ir para o pagamento</span></a>`;
  }
  return `<button class="btn btn-primary btn-lg btn-block" id="btn-comprar"><span>Comprar</span></button>`;
}

/* ---------------- Galeria ---------------- */
function galeriaHtml() {
  const fotos = m.galeria;
  if (!fotos.length) {
    return `<div class="galeria-main"><div class="galeria-vazia" aria-hidden="true">
      <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 12h6"/></svg>
      <span>Sem fotos de divulgação</span></div></div>`;
  }
  const nav = fotos.length > 1
    ? `<button class="galeria-nav prev" data-nav="-1" aria-label="Foto anterior">‹</button>
       <button class="galeria-nav next" data-nav="1" aria-label="Próxima foto">›</button>
       <span class="galeria-count" id="galeria-count">${fotoAtual + 1} / ${fotos.length}</span>`
    : '';
  const thumbs = fotos.length > 1
    ? `<div class="galeria-thumbs">${fotos
        .map((f, i) => `<button class="galeria-thumb ${i === fotoAtual ? 'ativa' : ''}" data-foto="${i}" aria-label="Ver foto ${i + 1}"><img src="${f}" alt="" loading="lazy" /></button>`)
        .join('')}</div>`
    : '';
  return `<div class="galeria-main"><img id="galeria-img" src="${fotos[fotoAtual]}" alt="Foto ${fotoAtual + 1} de ${escapeHtml(m.titulo)}" />${nav}</div>${thumbs}`;
}

function atualizarGaleria() {
  document.getElementById('galeria').innerHTML = galeriaHtml();
}

/* ---------------- Avaliações ---------------- */
function resumoHtml() {
  const a = m.avaliacoes;
  const barras = [5, 4, 3, 2, 1]
    .map((n) => {
      const pct = a.total ? Math.round((a.distribuicao[n] / a.total) * 100) : 0;
      return `<div class="aval-barra"><span>${n}★</span><div class="aval-trilho"><i style="width:${pct}%"></i></div><span>${a.distribuicao[n]}</span></div>`;
    })
    .join('');
  return `
    <div class="aval-media">${a.total ? a.media.toFixed(1).replace('.', ',') : '—'}</div>
    <div style="margin-top:6px">${stars(a.media)}</div>
    <p class="muted small" style="margin:6px 0 0">${a.total ? `${a.total} avaliaç${a.total > 1 ? 'ões' : 'ão'}` : 'Ninguém avaliou ainda'}</p>
    <div class="aval-barras">${barras}</div>`;
}

function avaliarBoxHtml() {
  if (!state.user) {
    return `<p class="aviso-compra"><a href="/login?next=${encodeURIComponent(location.pathname + location.search)}">Entre na sua conta</a> para avaliar este material depois de comprar.</p>`;
  }
  if (!m.comprado) {
    return '<p class="aviso-compra">🔒 Somente quem comprou pode avaliar. Assim todas as notas são de clientes reais.</p>';
  }
  // Já avaliou: a nota é definitiva, então mostra só as estrelas (sem botões).
  if (m.minhaNota) {
    return `<div class="avaliar-box"><p>Sua avaliação:</p><div>${stars(m.minhaNota)}</div><p class="muted small" style="margin:6px 0 0">Você já avaliou este material. Cada usuário avalia uma única vez.</p></div>`;
  }
  const botoes = [1, 2, 3, 4, 5]
    .map((n) => `<button type="button" data-nota="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}"><svg viewBox="0 0 24 24" class="star"><path d="${STAR_SVG_PATH}"/></svg></button>`)
    .join('');
  return `<div class="avaliar-box"><p>Avalie este material (só é possível uma vez):</p><div class="estrelas-input" id="estrelas-input">${botoes}</div></div>`;
}

function atualizarAvaliacoes() {
  document.getElementById('aval-resumo').innerHTML = resumoHtml() + avaliarBoxHtml();
  const ratingTopo = document.getElementById('rating-topo');
  if (ratingTopo) ratingTopo.innerHTML = ratingTopoHtml();
}

function ratingTopoHtml() {
  const a = m.avaliacoes;
  return a.total
    ? `${stars(a.media)} <strong>${a.media.toFixed(1).replace('.', ',')}</strong> <a href="#avaliacoes">(${a.total} avaliaç${a.total > 1 ? 'ões' : 'ão'})</a>`
    : '<a href="#avaliacoes">Seja o primeiro a avaliar</a>';
}

/* ---------------- Comentários ---------------- */
function comentarioHtml(c) {
  return `
  <article class="comentario" data-cid="${c.id}">
    <div class="comentario-topo">
      <span class="avatar" aria-hidden="true">${iniciais(c.autor)}</span>
      <span class="comentario-autor">${escapeHtml(c.autor)}</span>
      ${c.admin ? '<span class="selo loja">Loja</span>' : ''}
      ${c.compraVerificada ? '<span class="selo">Compra verificada</span>' : ''}
      ${c.nota ? stars(c.nota) : ''}
      <span class="comentario-data">${dataBr(c.createdAt)}</span>
    </div>
    <p>${escapeHtml(c.texto)}</p>
    ${c.podeExcluir ? `<button class="comentario-del" data-del="${c.id}">Excluir</button>` : ''}
  </article>`;
}

let jaComentei = false; // o usuário logado já tem um comentário neste material
let formRenderizadoComo = null; // evita redesenhar o formulário (e apagar o texto digitado) sem necessidade

async function carregarComentarios() {
  const lista = document.getElementById('comentario-lista');
  try {
    const dados = await api.get(`/api/materiais/${id}/comentarios`);
    const { comentarios } = dados;
    jaComentei = !!dados.jaComentei;
    lista.innerHTML = comentarios.length
      ? comentarios.map(comentarioHtml).join('')
      : '<p class="muted">Ainda não há comentários. Seja o primeiro a deixar um feedback!</p>';
  } catch (err) {
    lista.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
  atualizarFormComentario();
}

function atualizarFormComentario() {
  const box = document.getElementById('comentario-form-box');
  if (!box || formRenderizadoComo === jaComentei) return;
  box.innerHTML = comentarioFormHtml();
  formRenderizadoComo = jaComentei;
}

function comentarioFormHtml() {
  if (!state.user) {
    return `<p class="muted"><a href="/login?next=${encodeURIComponent(location.pathname + location.search)}">Entre na sua conta</a> para comentar.</p>`;
  }
  if (jaComentei) {
    return '<p class="aviso-compra">Você já comentou neste material. Para escrever outro comentário, exclua o seu.</p>';
  }
  return `
  <form class="comentario-form" id="comentario-form" novalidate>
    <label class="sr-only" for="comentario-texto" style="position:absolute;left:-9999px">Seu comentário</label>
    <textarea id="comentario-texto" maxlength="1000" placeholder="Conte como foi sua experiência com este material…"></textarea>
    <div class="linha">
      <span class="contador-chars"><span id="chars">0</span>/1000</span>
      <button type="submit" class="btn btn-primary btn-sm"><span class="btn-text">Publicar comentário</span></button>
    </div>
  </form>`;
}

/* ---------------- Página ---------------- */
function render() {
  document.title = `${m.titulo} · SlideHub`;
  const pacote = m.arquivos.length
    ? `<div class="produto-box"><h2>O que você recebe (${m.arquivos.length} arquivo${m.arquivos.length > 1 ? 's' : ''})</h2>
        <ul class="pacote-lista">${m.arquivos
          .map((a) => `<li><span>${escapeHtml(a.nomeArquivo)}</span><span class="muted small">${a.tipo === 'PPTX' ? 'PowerPoint' : 'Imagem'} · ${tamanhoBr(a.tamanho)}</span></li>`)
          .join('')}</ul></div>`
    : '';

  root.innerHTML = `
  <nav class="breadcrumb" aria-label="Você está em"><a href="/">Vitrine</a><span>›</span><span>${escapeHtml(m.titulo)}</span></nav>
  <div class="produto">
    <div id="galeria">${galeriaHtml()}</div>
    <div class="produto-info">
      <span class="chip" style="position:static;display:inline-block">${LABEL_TIPO[m.tipo] || 'Digital'}</span>
      <h1>${escapeHtml(m.titulo)}</h1>
      <div class="rating-inline" id="rating-topo">${ratingTopoHtml()}</div>
      <div class="produto-preco">${money(m.preco)}</div>
      <p class="muted small" style="margin:0 0 14px">Pagamento via Pix · download imediato após a confirmação</p>
      <div id="acao-compra">${botaoCompra()}</div>
      <p class="produto-desc">${m.descricao ? escapeHtml(m.descricao) : '<span class="muted">O vendedor não adicionou uma descrição.</span>'}</p>
      ${pacote}
      <p class="produto-garantia">🔒 Acesso protegido pela sua conta. Só quem compra consegue baixar os arquivos.</p>
    </div>
  </div>

  <section class="secao-feedback" id="avaliacoes" aria-label="Avaliações e comentários">
    <aside class="aval-resumo" id="aval-resumo">${resumoHtml()}${avaliarBoxHtml()}</aside>
    <div class="comentarios">
      <h2>Comentários</h2>
      <div id="comentario-form-box"></div>
      <div class="comentario-lista" id="comentario-lista"><p class="muted">Carregando…</p></div>
    </div>
  </section>`;
  formRenderizadoComo = null;
  carregarComentarios(); // também desenha o formulário (ou o aviso de "já comentou")
}

async function carregar() {
  if (!Number.isInteger(id) || id < 1) {
    root.innerHTML = emptyState({ titulo: 'Material não encontrado', texto: 'O link está incompleto.', acaoHref: '/', acaoLabel: 'Voltar à vitrine', icone: 'alert' });
    return;
  }
  try {
    ({ material: m } = await api.get(`/api/materiais/${id}`));
    render();
  } catch (err) {
    root.innerHTML = emptyState({
      titulo: err.status === 404 ? 'Material não encontrado' : 'Não foi possível carregar',
      texto: err.message, acaoHref: '/', acaoLabel: 'Voltar à vitrine', icone: 'alert',
    });
  }
}

/* ---------------- Eventos ---------------- */
root.addEventListener('click', async (e) => {
  // Galeria
  const thumb = e.target.closest('[data-foto]');
  if (thumb) { fotoAtual = Number(thumb.dataset.foto); return atualizarGaleria(); }
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const n = m.galeria.length;
    fotoAtual = (fotoAtual + Number(nav.dataset.nav) + n) % n;
    return atualizarGaleria();
  }
  if (e.target.id === 'galeria-img') {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `<img src="${m.galeria[fotoAtual]}" alt="" />`;
    const fecha = () => { box.remove(); document.removeEventListener('keydown', esc); };
    const esc = (ev) => { if (ev.key === 'Escape') fecha(); };
    box.addEventListener('click', fecha);
    document.addEventListener('keydown', esc);
    return document.body.appendChild(box);
  }

  // Comprar
  if (e.target.closest('#btn-comprar')) {
    const btn = document.getElementById('btn-comprar');
    btn.disabled = true;
    btn.innerHTML = `${SPINNER}<span>Adicionando…</span>`;
    try {
      await api.post('/api/carrinho', { materialId: m.id });
      m.noCarrinho = true;
      toast('Adicionado ao carrinho!', 'success');
      document.getElementById('acao-compra').innerHTML = botaoCompra();
      refreshCartCount();
    } catch (err) {
      if (err.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
      toast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Comprar</span>';
    }
    return;
  }

  // Avaliar
  const notaBtn = e.target.closest('[data-nota]');
  if (notaBtn) {
    try {
      const r = await api.put(`/api/materiais/${m.id}/avaliacao`, { nota: Number(notaBtn.dataset.nota) });
      m.minhaNota = r.minhaNota;
      m.avaliacoes = r.avaliacoes;
      atualizarAvaliacoes();
      carregarComentarios();
      toast('Obrigado pela avaliação!', 'success');
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 409) {
        // Já havia avaliado (outra aba/dispositivo): sincroniza e trava as estrelas.
        try {
          ({ material: m } = await api.get(`/api/materiais/${id}`));
          atualizarAvaliacoes();
        } catch { /* mantém a tela como está */ }
      }
    }
    return;
  }

  // Excluir comentário
  const del = e.target.closest('[data-del]');
  if (del) {
    const ok = await showModal({ titulo: 'Excluir comentário', corpo: '<p>Tem certeza que deseja excluir este comentário?</p>', okLabel: 'Excluir', perigo: true });
    if (!ok) return;
    try {
      await api.del(`/api/materiais/comentarios/${del.dataset.del}`);
      toast('Comentário excluído.', 'success');
      carregarComentarios();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

root.addEventListener('input', (e) => {
  if (e.target.id === 'comentario-texto') document.getElementById('chars').textContent = e.target.value.length;
});

root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'comentario-form') return;
  e.preventDefault();
  const campo = document.getElementById('comentario-texto');
  const texto = campo.value.trim();
  if (texto.length < 3) return toast('Escreva pelo menos 3 caracteres.', 'error');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await api.post(`/api/materiais/${m.id}/comentarios`, { texto });
    campo.value = '';
    document.getElementById('chars').textContent = '0';
    toast('Comentário publicado!', 'success');
    carregarComentarios();
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 409) carregarComentarios(); // já tinha comentado: troca o formulário pelo aviso
  } finally {
    btn.disabled = false;
  }
});

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
  refreshCartCount();
  carregar();
})();
