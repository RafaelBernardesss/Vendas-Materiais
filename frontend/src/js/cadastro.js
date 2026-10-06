import { api } from './api.js';
import { renderHeader, renderFooter, loadUser, toast } from './ui.js';

const form = document.getElementById('form-cadastro');
const erro = document.getElementById('form-erro');
const params = new URLSearchParams(location.search);
const nasc = document.getElementById('nascimento');

// Data limite: hoje
nasc.max = new Date().toISOString().slice(0, 10);

function mostrarErro(msg) {
  erro.textContent = msg || '';
  erro.hidden = !msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarErro('');

  const nome = form.nome.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const senha = form.senha.value;
  const confirmar = form.confirmar.value;
  const dataNascimento = nasc.value;

  if (nome.length < 3) return mostrarErro('Informe seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarErro('Informe um e-mail válido.');
  if (senha.length < 8) return mostrarErro('A senha deve ter pelo menos 8 caracteres.');
  if (senha !== confirmar) return mostrarErro('As senhas não conferem.');
  if (!dataNascimento) return mostrarErro('Informe sua data de nascimento.');
  const d = new Date(dataNascimento);
  const idade = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() || idade < 0 || idade > 120) {
    return mostrarErro('Data de nascimento inválida.');
  }

  const btn = form.querySelector('button[type="submit"]');
  const rotulo = btn.querySelector('.btn-text');
  btn.disabled = true;
  rotulo.textContent = 'Criando conta…';

  try {
    const { user } = await api.post('/api/auth/cadastro', {
      nome, email, senha, dataNascimento,
    });
    toast(`Conta criada, ${user.nome.split(' ')[0]}! Bem-vindo à SlideHub.`, 'success');
    const next = params.get('next');
    location.href = next && next.startsWith('/') ? next : '/';
  } catch (err) {
    mostrarErro(err.message);
    btn.disabled = false;
    rotulo.textContent = 'Criar minha conta';
  }
});

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
})();
