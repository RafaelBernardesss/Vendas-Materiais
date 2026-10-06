import { api } from './api.js';

export const state = { user: null };

/* ---------------- Utilidades ---------------- */
export const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function dataBr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function tamanhoBr(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function iniciais(nome) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export const SPINNER = '<span class="spinner" aria-hidden="true"></span>';

export const SVG_CART =
  '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4 6h2l2.4 10.4a1 1 0 001 .6h8.4a1 1 0 001-.8L20.5 9H7"/><circle cx="10" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/></svg>';

export const SVG_DOWNLOAD =
  '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>';

const STAR_PATH = 'M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.2 1.2-6.6L2.5 9.6l6.6-.9z';

/** Estrelas somente leitura (aceita notas quebradas, ex.: 4.3 → 4 cheias). */
export function stars(nota = 0) {
  const cheias = Math.round(Number(nota) || 0);
  return `<span class="stars" role="img" aria-label="${nota} de 5 estrelas">${[1, 2, 3, 4, 5]
    .map((i) => `<svg viewBox="0 0 24 24" class="star ${i <= cheias ? 'on' : ''}"><path d="${STAR_PATH}"/></svg>`)
    .join('')}</span>`;
}

export const STAR_SVG_PATH = STAR_PATH;

/* ---------------- Sessão ---------------- */
export async function loadUser() {
  try {
    const { user } = await api.get('/api/auth/me');
    state.user = user;
  } catch {
    state.user = null;
  }
  return state.user;
}

export function requireAuth(page) {
  if (!state.user) {
    location.href = `/login?next=${encodeURIComponent(page)}`;
    return false;
  }
  return true;
}

/* ---------------- Layout ---------------- */
const LOGO =
  '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#E4572E"/><path d="M18 42l10-20 10 20" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 34h10" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const u = state.user;
  const rota = location.pathname;

  el.innerHTML = `
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="SlideHub — página inicial">
        ${LOGO}
        <span class="brand-name">Slide<b>Hub</b></span>
      </a>
      <nav class="main-nav" aria-label="Navegação principal">
        <a href="/" class="${rota === '/' ? 'active' : ''}">Início</a>
        ${u ? `<a href="/meus-materiais" class="${rota === '/meus-materiais' ? 'active' : ''}">Meus materiais</a>` : ''}
        ${u && u.role === 'ADMIN' ? `<a href="/admin" class="${rota === '/admin' ? 'active' : ''}">Painel</a>` : ''}
      </nav>
      <div class="header-actions">
        <a class="cart-btn" href="/carrinho" aria-label="Ver carrinho">
          ${SVG_CART}
          <span class="cart-count" id="cart-count" hidden>0</span>
        </a>
        ${u
          ? userMenuHtml(u)
          : '<div class="auth-links"><a class="btn btn-ghost btn-sm" href="/login">Entrar</a><a class="btn btn-primary btn-sm" href="/cadastro">Criar conta</a></div>'}
      </div>
    </div>
  </header>`;

  if (u) wireUserMenu(u);
}

function userMenuHtml(u) {
  return `
  <div class="user-menu">
    <button class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-label="Menu do usuário">
      <span class="avatar" aria-hidden="true">${iniciais(u.nome)}</span>
      <span class="user-nome">${escapeHtml(u.nome.split(' ')[0])}</span>
      <svg viewBox="0 0 24 24" class="chev" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="user-dropdown" id="user-dropdown" hidden>
      <a href="/meus-materiais">Meus materiais</a>
      ${u.role === 'ADMIN' ? '<a href="/admin">Painel do admin</a>' : ''}
      <button id="btn-sair" type="button" class="sair">Sair da conta</button>
    </div>
  </div>`;
}

function wireUserMenu(u) {
  const btn = document.getElementById('user-btn');
  const dd = document.getElementById('user-dropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const fechara = !dd.hidden;
    dd.hidden = fechara;
    btn.setAttribute('aria-expanded', String(!fechara));
  });
  document.addEventListener('click', () => {
    dd.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });
  document.getElementById('btn-sair').addEventListener('click', async () => {
    try {
      await api.post('/api/auth/sair');
    } catch {
      /* segue o logout */
    }
    location.href = '/';
  });
}

export function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        ${LOGO}
        <div>
          <p class="footer-name">SlideHub</p>
          <p class="footer-tag">Materiais digitais prontos para usar. Pague com Pix e baixe na hora.</p>
        </div>
      </div>
      <nav class="footer-col" aria-label="Loja">
        <h3>Loja</h3>
        <a href="/">Vitrine</a>
        <a href="/carrinho">Carrinho</a>
        <a href="/meus-materiais">Meus materiais</a>
      </nav>
      <nav class="footer-col" aria-label="Conta">
        <h3>Conta</h3>
        <a href="/login">Entrar</a>
        <a href="/cadastro">Criar conta</a>
      </nav>
    </div>
    <div class="container footer-base">
      <span>© ${new Date().getFullYear()} SlideHub · Todos os direitos reservados</span>
      <span>Feito com Pix, café e PowerPoint.</span>
    </div>
  </footer>`;
}

/* ---------------- Carrinho (contador) ---------------- */
export async function refreshCartCount() {
  const badge = document.getElementById('cart-count');
  if (!badge || !state.user) return;
  try {
    const { itens } = await api.get('/api/carrinho');
    badge.textContent = itens.length;
    badge.hidden = itens.length === 0;
  } catch {
    /* silencioso */
  }
}

/* ---------------- Toasts ---------------- */
export function toast(mensagem, tipo = 'info', duracao = 3800) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.setAttribute('role', 'status');
  const icone =
    tipo === 'success'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'
      : tipo === 'error'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v.5m0 3.5v5M12 21a9 9 0 110-18 9 9 0 010 18z"/></svg>';
  el.innerHTML = `${icone}<span>${escapeHtml(mensagem)}</span><button class="toast-x" aria-label="Fechar aviso">×</button>`;
  box.appendChild(el);

  let fechado = false;
  const fecha = () => {
    if (fechado) return;
    fechado = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('.toast-x').addEventListener('click', fecha);
  setTimeout(fecha, duracao);
}

/* ---------------- Estados vazios / skeleton ---------------- */
export function skeletonGrid(n = 8) {
  return Array.from(
    { length: n },
    () => `
    <div class="card skel-card" aria-hidden="true">
      <div class="skel skel-cover"></div>
      <div class="card-body">
        <div class="skel skel-line w80"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line w60"></div>
        <div class="skel skel-btn"></div>
      </div>
    </div>`
  ).join('');
}

export function emptyState({ titulo, texto, acaoHref, acaoLabel, icone = 'box' }) {
  const icons = {
    cart: '<path d="M4 6h2l2.4 10.4a1 1 0 001 .6h8.4a1 1 0 001-.8L20.5 9H7"/><circle cx="10" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',
    alert: '<path d="M12 8v5m0 3.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z"/>',
  };
  return `
  <div class="empty">
    <div class="empty-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[icone] || icons.box}</svg></div>
    <h3>${escapeHtml(titulo)}</h3>
    <p>${escapeHtml(texto)}</p>
    ${acaoHref ? `<a class="btn btn-primary" href="${acaoHref}">${escapeHtml(acaoLabel)}</a>` : ''}
  </div>`;
}

/* ---------------- Modal de confirmação ---------------- */
export function showModal({ titulo, corpo = '', okLabel = 'Confirmar', cancelLabel = 'Cancelar', perigo = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <h3 id="modal-titulo">${escapeHtml(titulo)}</h3>
        ${corpo ? `<div class="modal-corpo">${corpo}</div>` : ''}
        <div class="modal-acoes">
          <button type="button" class="btn btn-ghost" data-act="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    root.appendChild(overlay);
    const okBtn = overlay.querySelector('[data-act="ok"]');
    okBtn.focus();

    const fecha = (v) => {
      overlay.remove();
      document.removeEventListener('keydown', esc);
      resolve(v);
    };
    const esc = (e) => {
      if (e.key === 'Escape') fecha(false);
    };
    document.addEventListener('keydown', esc);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fecha(false);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => fecha(false));
    okBtn.addEventListener('click', () => fecha(true));
  });
}
