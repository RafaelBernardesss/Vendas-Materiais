import { api } from './api.js';
import {
  state, renderHeader, renderFooter, loadUser, refreshCartCount,
  toast, skeletonGrid, emptyState, money, escapeHtml, SPINNER, SVG_CART, SVG_DOWNLOAD, stars,
} from './ui.js';

const grid = document.getElementById('vitrine-grid');
const LABEL_TIPO = { POWERPOINT: 'PowerPoint', IMAGENS: 'Imagens', MISTO: 'PPT + Imagens' };

const SVG_FALLBACK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 12h6"/></svg>';

function botao(m) {
  if (m.comprado) {
    const href = m.arquivoId ? `/api/downloads/arquivo/${m.arquivoId}` : `/api/downloads/material/${m.id}`;
    return `<a class="btn btn-pix btn-block" href="${href}">${SVG_DOWNLOAD}<span>Download</span></a>`;
  }
  if (m.noCarrinho) {
    return `<a class="btn btn-outline btn-block" href="/carrinho">${SVG_CART}<span>No carrinho</span></a>`;
  }
  return `<button class="btn btn-primary btn-block" data-action="comprar" data-id="${m.id}"><span>Comprar</span></button>`;
}

function cardHtml(m) {
  const capa = m.capa
    ? `<img class="card-img" src="${m.capa}" alt="" loading="lazy" />`
    : `<div class="card-img card-fallback" aria-hidden="true">${SVG_FALLBACK}</div>`;
  return `
  <article class="card">
    <div class="card-cover"><a href="/produto?id=${m.id}" aria-label="Ver detalhes de ${escapeHtml(m.titulo)}">${capa}</a><span class="chip">${LABEL_TIPO[m.tipo] || 'Digital'}</span></div>
    <div class="card-body">
      <h3 class="card-title"><a href="/produto?id=${m.id}">${escapeHtml(m.titulo)}</a></h3>
      <div class="rating-inline">${m.totalAvaliacoes
        ? `${stars(m.media)} <strong>${m.media.toFixed(1).replace('.', ',')}</strong> <span>(${m.totalAvaliacoes})</span>`
        : '<span>Sem avaliações ainda</span>'}</div>
      <p class="card-desc">${m.descricao ? escapeHtml(m.descricao) : '<span class="muted">Sem descrição.</span>'}</p>
      <div class="card-meta">
        <span class="price">${money(m.preco)}</span>
        ${m.nArquivos ? `<span class="muted small">· ${m.nArquivos} arquivo${m.nArquivos > 1 ? 's' : ''}</span>` : ''}
      </div>
      ${botao(m)}
      <a class="card-link" href="/produto?id=${m.id}">Ver detalhes e avaliações →</a>
    </div>
  </article>`;
}

async function render() {
  grid.innerHTML = skeletonGrid(8);
  try {
    const { materiais } = await api.get('/api/materiais');
    if (!materiais.length) {
      grid.innerHTML = emptyState({
        titulo: 'A vitrine está vazia',
        texto: 'Nenhum material publicado até agora. Volte em breve!',
        icone: 'box',
      });
      return;
    }
    grid.innerHTML = materiais.map(cardHtml).join('');
  } catch (err) {
    grid.innerHTML = emptyState({ titulo: 'Não foi possível carregar', texto: err.message, icone: 'alert' });
  }
}

grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="comprar"]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  btn.disabled = true;
  btn.innerHTML = `${SPINNER}<span>Adicionando…</span>`;
  try {
    await api.post('/api/carrinho', { materialId: id });
    toast('Adicionado ao carrinho!', 'success');
    btn.outerHTML = `<a class="btn btn-outline btn-block" href="/carrinho">${SVG_CART}<span>No carrinho</span></a>`;
    refreshCartCount();
  } catch (err) {
    if (err.status === 401) {
      location.href = '/login';
      return;
    }
    toast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>Comprar</span>';
  }
});

(async function init() {
  await loadUser();
  // Visitantes veem a apresentação; quem já está logado vai direto para a vitrine.
  if (!state.user) document.getElementById('hero').hidden = false;
  renderHeader();
  renderFooter();
  refreshCartCount();
  render();
})();
