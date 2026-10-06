import QRCode from 'qrcode';
import { api } from './api.js';
import {
  renderHeader, renderFooter, loadUser, requireAuth, toast,
  money, escapeHtml, SPINNER, refreshCartCount,
} from './ui.js';

const loading = document.getElementById('checkout-carregando');
const passoDados = document.getElementById('checkout-passo-dados');
const passoQr = document.getElementById('checkout-passo-qr');
const passoSucesso = document.getElementById('checkout-passo-sucesso');
const form = document.getElementById('form-checkout');
const erro = document.getElementById('form-erro');
const inputCpf = document.getElementById('cpf');
const canvas = document.getElementById('qr-canvas');
const txtCopiar = document.getElementById('qr-copiar');
const statusPill = document.getElementById('status-pill');
const statusTexto = document.getElementById('status-texto');

let orderId = null;
let polling = null;

/* ---------- CPF: máscara + validação (mesma regra do servidor) ---------- */
function soDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}
function formatarCpf(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}
function validarCpf(valor) {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n) => {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += parseInt(d[i], 10) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === parseInt(d[9], 10) && digito(10) === parseInt(d[10], 10);
}

inputCpf.addEventListener('input', () => {
  inputCpf.value = formatarCpf(inputCpf.value);
});

/* ---------- Etapa 1: carregar resumo ---------- */
async function carregarResumo() {
  try {
    const { itens, total } = await api.get('/api/carrinho');
    if (!itens.length) {
      toast('Seu carrinho está vazio.', 'info');
      location.href = '/carrinho';
      return;
    }
    document.getElementById('resumo-itens').innerHTML = itens
      .map(
        (i) => `
      <li>
        <span>${escapeHtml(i.titulo)}</span>
        <span>${money(i.preco)}</span>
      </li>`
      )
      .join('');
    document.getElementById('resumo-valor').textContent = money(total);
    loading.hidden = true;
    passoDados.hidden = false;
  } catch (err) {
    loading.hidden = true;
    toast(err.message, 'error');
  }
}

/* ---------- Etapa 2: QR + polling ---------- */
function mostrarQr({ qrCode, expiresAt, mock }) {
  passoDados.hidden = true;
  passoQr.hidden = false;

  QRCode.toCanvas(canvas, qrCode, {
    width: 220,
    margin: 1,
    color: { dark: '#171512', light: '#FFFFFF' },
  }).catch(() => toast('Não foi possível gerar o QR Code.', 'error'));

  txtCopiar.value = qrCode;

  if (expiresAt) {
    document.getElementById('qr-validade').textContent =
      `O código expira às ${new Date(expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
  }
  if (mock) document.getElementById('modo-mock').hidden = false;

  definirStatus('aguardando', 'Aguardando pagamento…');
  iniciarPolling();
}

function definirStatus(tipo, texto) {
  statusPill.className = `status-pill ${tipo}`;
  statusTexto.textContent = texto;
}

function iniciarPolling() {
  pararPolling();
  polling = setInterval(checarStatus, 3000);
  setTimeout(checarStatus, 1200); // primeira verificação mais cedo
}

function pararPolling() {
  if (polling) {
    clearInterval(polling);
    polling = null;
  }
}

async function checarStatus() {
  if (!orderId) return;
  try {
    const { status } = await api.get(`/api/pagamentos/${orderId}/status`);
    if (status === 'PAID') confirmar();
  } catch {
    /* mantém tentando */
  }
}

function confirmar() {
  pararPolling();
  definirStatus('ok', 'Pagamento confirmado!');
  passoQr.hidden = true;
  passoSucesso.hidden = false;
  toast('Pagamento confirmado! Materiais liberados.', 'success');
  refreshCartCount();
}

/* ---------- Ações ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = (m) => {
    erro.textContent = m || '';
    erro.hidden = !m;
  };
  msg('');

  const nomeCompleto = form.nomeCompleto.value.trim();
  const cpf = inputCpf.value;
  if (nomeCompleto.length < 5 || nomeCompleto.split(/\s+/).length < 2) {
    return msg('Informe seu nome completo (nome e sobrenome).');
  }
  if (!validarCpf(cpf)) return msg('CPF inválido. Confira os dígitos.');

  const btn = form.querySelector('button[type="submit"]');
  const rotulo = btn.querySelector('.btn-text');
  btn.disabled = true;
  rotulo.textContent = 'Gerando cobrança…';

  try {
    const r = await api.post('/api/pagamentos/criar', { nomeCompleto, cpf });
    orderId = r.orderId;
    if (r.status === 'PAID') {
      mostrarQr(r);
      confirmar();
    } else {
      mostrarQr(r);
    }
  } catch (err) {
    msg(err.message);
    btn.disabled = false;
    rotulo.textContent = 'Gerar cobrança Pix';
  }
});

document.getElementById('btn-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(txtCopiar.value);
    toast('Código Pix copiado!', 'success');
  } catch {
    txtCopiar.select();
    document.execCommand('copy');
    toast('Código Pix copiado!', 'success');
  }
});

document.getElementById('btn-simular').addEventListener('click', async () => {
  const btn = document.getElementById('btn-simular');
  btn.disabled = true;
  btn.innerHTML = `${SPINNER}<span>Processando…</span>`;
  try {
    await api.post(`/api/pagamentos/${orderId}/simular-aprovacao`);
    toast('Pagamento simulado com sucesso.', 'success');
    checarStatus();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Simular pagamento aprovado';
  }
});

window.addEventListener('pagehide', pararPolling);

(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();
  if (!requireAuth('/checkout')) return;
  carregarResumo();
})();
