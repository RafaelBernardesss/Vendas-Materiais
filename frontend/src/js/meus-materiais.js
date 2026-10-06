import { api } from './api.js';
import {
  renderHeader, renderFooter, loadUser, requireAuth,
  money, escapeHtml, dataBr, tamanhoBr, emptyState,
} from './ui.js';

const grid = document.getElementById('meus-grid');

const ICONES_TIPO = {
  PPTX: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
  IMAGEM: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 3 3 4-4 4 4"/>',
};

function arquivoHtml(f) {
  const icon = ICONES_TIPO[f.tipo] || ICONES_TIPO.IMAGEM;
  return `
  <li class="meus-arquivo">
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">${icon}</svg>
    <span class="meus-arquivo-nome" title="${escapeHtml(f.nomeArquivo)}">${escapeHtml(f.nomeArquivo)}</span>
    <span class="muted small">${tamanhoBr(f.tamanho)}</span>
    <a class="btn btn-outline btn-sm" href="/api/downloads/arquivo/${f.id}">
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
      <span>Baixar</span>
    </a>
  </li>`;
}

function cardHtml(m) {
  const capa = m.material.capa
    ? `<img class="meus-capa" src="${m.material.capa}" alt="" />`
    : '<div class="meus-capa meus-capa-fallback" aria-hidden="true">PPT</div>';
  const zip =
    m.arquivos.length > 1
      ? `<a class="btn btn-pix btn-sm" href="/api/downloads/material/${m.material.id}">
           <svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
           <span>Baixar tudo (.zip)</span>
         </a>`
      : '';
  return `
  <article class="meus-card panel">
    ${capa}
    <div class="meus-info">
      <div class="meus-topo">
        <div>
          <h3>${escapeHtml(m.material.titulo)}</h3>
          <p class="muted small">Comprado em ${dataBr(m.compradoEm)} · ${money(m.material.preco)}</p>
        </div>
        ${zip}
      </div>
      <ul class="meus-arquivos">${m.arquivos.map(arquivoHtml).join('')}</ul>
    </div>
  </article>`;
}

async function carregar() {
  try {
    const { materiais } = await api.get('/api/downloads/meus');
    if (!materiais.length) {
      grid.innerHTML = emptyState({
        titulo: 'Você ainda não comprou nada',
        texto: 'Quando um pagamento Pix for confirmado, o material aparece aqui com download vitalício.',
        acaoHref: '/',
        acaoLabel: 'Explorar a vitrine',
        icone: 'download',
      });
      return;
    }
    grid.innerHTML = materiais.map(cardHtml).join('');
  } catch (err) {
    grid.innerHTML = emptyState({ titulo: 'Não foi possível carregar', texto: err.message, icone: 'alert' });
  }
}

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
  if (!requireAuth('/meus-materiais')) return;
  carregar();
})();
