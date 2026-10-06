import { api } from './api.js';
import {
  renderHeader, renderFooter, loadUser, requireAuth, toast,
  money, escapeHtml, emptyState, refreshCartCount,
} from './ui.js';

const area = document.getElementById('carrinho-area');

function itemHtml(i) {
  const capa = i.capa
    ? `<img class="carr-item-capa" src="${i.capa}" alt="" />`
    : '<div class="carr-item-capa carr-item-capa-fallback" aria-hidden="true">PPT</div>';
  return `
  <li class="carr-item" data-id="${i.materialId}">
    ${capa}
    <div class="carr-item-info">
      <strong>${escapeHtml(i.titulo)}</strong>
      <span class="muted small">${i.nArquivos} arquivo${i.nArquivos > 1 ? 's' : ''} · download vitalício</span>
    </div>
    <span class="carr-item-preco">${money(i.preco)}</span>
    <button class="btn btn-ghost btn-sm carr-remove" data-id="${i.materialId}" aria-label="Remover ${escapeHtml(i.titulo)} do carrinho">
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4 7h16M10 4h4M9 7v13m6-13v13M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></svg>
    </button>
  </li>`;
}

function render({ itens, total }) {
  if (!itens.length) {
    area.innerHTML = emptyState({
      titulo: 'Seu carrinho está vazio',
      texto: 'Explore a vitrine e adicione seus primeiros materiais.',
      acaoHref: '/',
      acaoLabel: 'Ver materiais',
      icone: 'cart',
    });
    return;
  }
  area.innerHTML = `
  <ul class="carr-list">${itens.map(itemHtml).join('')}</ul>
  <div class="carr-rodape panel">
    <div class="resumo-total"><span>Total</span><strong>${money(total)}</strong></div>
    <a class="btn btn-pix btn-lg" href="/checkout">
      <span class="btn-text">Continuar para o pagamento</span>
    </a>
  </div>`;
}

async function carregar() {
  try {
    const dados = await api.get('/api/carrinho');
    render(dados);
  } catch (err) {
    area.innerHTML = emptyState({ titulo: 'Não foi possível carregar', texto: err.message, icone: 'alert' });
  }
}

area.addEventListener('click', async (e) => {
  const btn = e.target.closest('.carr-remove');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  btn.disabled = true;
  try {
    await api.del(`/api/carrinho/${id}`);
    toast('Item removido do carrinho.', 'info');
    await carregar();
    refreshCartCount();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
  if (!requireAuth('/carrinho')) return;
  carregar();
  refreshCartCount();
})();
