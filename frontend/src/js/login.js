import { api } from './api.js';
import { renderHeader, renderFooter, loadUser, toast, state } from './ui.js';

const form = document.getElementById('form-login');
const erro = document.getElementById('form-erro');
const params = new URLSearchParams(location.search);

function mostrarErro(msg) {
  erro.textContent = msg || '';
  erro.hidden = !msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarErro('');

  const email = form.email.value.trim().toLowerCase();
  const senha = form.senha.value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarErro('Informe um e-mail válido.');
  if (!senha) return mostrarErro('Informe sua senha.');

  const btn = form.querySelector('button[type="submit"]');
  const rotulo = btn.querySelector('.btn-text');
  btn.disabled = true;
  rotulo.textContent = 'Entrando…';

  try {
    const { user } = await api.post('/api/auth/login', { email, senha });
    toast(`Olá, ${user.nome.split(' ')[0]}!`, 'success');
    const next = params.get('next');
    location.href = user.role === 'ADMIN' ? '/admin' : next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  } catch (err) {
    mostrarErro(err.message);
    btn.disabled = false;
    rotulo.textContent = 'Entrar';
  }
});

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
  // Já logado: vai direto para o lugar certo
  if (state.user) {
    location.replace(state.user.role === 'ADMIN' ? '/admin' : '/');
  }
})();
