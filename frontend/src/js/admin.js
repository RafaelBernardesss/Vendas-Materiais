import { api } from './api.js';
import {
  state, renderHeader, renderFooter, loadUser, toast,
  money, escapeHtml, dataBr, tamanhoBr, showModal,
} from './ui.js';

const wrap = document.getElementById('admin-tabela-wrap');
const formPub = document.getElementById('form-publicar');
const inputArquivos = document.getElementById('pub-arquivos');
const listaArquivos = document.getElementById('lista-arquivos');
const capaHint = document.getElementById('capa-hint');
const inputFotos = document.getElementById('pub-fotos');
const listaFotos = document.getElementById('lista-fotos');
const FOTO_OK = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

const EXT_OCR = ['ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'];
const IMG_OCR = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'];
const MAX_MB = 25;

let selecionados = []; // File[] (arquivos do material)
let fotosSel = []; // File[] (fotos do anúncio)

/* ---------------- Lista de materiais ---------------- */
function linhaHtml(m) {
  const capa = m.capa
    ? `<img class="admin-thumb" src="${m.capa}" alt="" />`
    : '<div class="admin-thumb admin-thumb-fallback" aria-hidden="true">S</div>';
  return `
  <tr data-id="${m.id}">
    <td class="admin-td-material">
      ${capa}
      <div>
        <strong>${escapeHtml(m.titulo)}</strong>
        <span class="muted small">${m.tipos.join(' + ')} · ${m.nArquivos} arquivo${m.nArquivos > 1 ? 's' : ''}</span>
      </div>
    </td>
    <td>${money(m.preco)}</td>
    <td>${m.vendas > 0 ? `<span class="pill-vendas">${m.vendas}</span>` : '<span class="muted">0</span>'}</td>
    <td class="muted small">${dataBr(m.createdAt)}</td>
    <td class="admin-td-acoes">
      <button class="btn btn-outline btn-sm" data-acao="editar" data-id="${m.id}">Editar</button>
      <button class="btn btn-danger btn-sm" data-acao="excluir" data-id="${m.id}">Excluir</button>
    </td>
  </tr>`;
}

async function carregarLista() {
  try {
    const { materiais } = await api.get('/api/admin/materiais');
    if (!materiais.length) {
      wrap.innerHTML = `
        <div class="empty">
          <div class="empty-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg></div>
          <h3>Nenhum material publicado</h3>
          <p>Use o formulário ao lado para publicar o primeiro material da loja.</p>
        </div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Material</th><th>Preço</th><th>Vendas</th><th>Publicado em</th><th>Ações</th></tr>
          </thead>
          <tbody>${materiais.map(linhaHtml).join('')}</tbody>
        </table>
      </div>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------------- Arquivos do formulário ---------------- */
function extDo(nome) {
  return (nome || '').split('.').pop().toLowerCase();
}

function renderLista() {
  if (!selecionados.length) {
    listaArquivos.innerHTML = '';
    capaHint.textContent = 'Sem fotos do anúncio, a primeira imagem desta lista vira a capa.';
    return;
  }
  listaArquivos.innerHTML = selecionados
    .map(
      (f, idx) => `
    <li class="file-chip">
      <svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>
      <span class="file-chip-nome">${escapeHtml(f.name)}</span>
      <span class="muted small">${tamanhoBr(f.size)}${idx === 0 && IMG_OCR.includes(extDo(f.name)) ? ' · capa' : ''}</span>
      <button type="button" class="file-chip-x" data-idx="${idx}" aria-label="Remover ${escapeHtml(f.name)}">×</button>
    </li>`
    )
    .join('');

  const primeiraImg = selecionados.find((f) => IMG_OCR.includes(extDo(f.name)));
  capaHint.textContent = primeiraImg
    ? `Sem fotos do anúncio, a capa será: ${primeiraImg.name}`
    : 'Nenhuma imagem na lista — adicione fotos do anúncio para o material ter capa.';
}

/* ---------------- Fotos do anúncio (formulário) ---------------- */
function aceitaFotos(files) {
  const ok = [];
  for (const f of files) {
    if (!FOTO_OK.includes(extDo(f.name))) { toast(`"${f.name}" não é uma foto aceita (use jpg, png, webp, gif ou avif).`, 'error'); continue; }
    if (f.size > MAX_MB * 1024 * 1024) { toast(`"${f.name}" excede ${MAX_MB} MB.`, 'error'); continue; }
    ok.push(f);
  }
  return ok;
}

function renderFotosSel() {
  listaFotos.innerHTML = fotosSel
    .map((f, i) => `
    <div class="foto-item">
      <img src="${URL.createObjectURL(f)}" alt="${escapeHtml(f.name)}" />
      <button type="button" class="foto-x" data-fidx="${i}" aria-label="Remover ${escapeHtml(f.name)}">×</button>
      ${i === 0 ? '<span class="foto-tag">CAPA</span>' : ''}
    </div>`)
    .join('');
}

inputFotos.addEventListener('change', () => {
  for (const f of aceitaFotos(inputFotos.files)) {
    if (!fotosSel.some((s) => s.name === f.name && s.size === f.size)) fotosSel.push(f);
  }
  if (fotosSel.length > 10) { fotosSel = fotosSel.slice(0, 10); toast('Máximo de 10 fotos por material.', 'error'); }
  inputFotos.value = '';
  renderFotosSel();
});

listaFotos.addEventListener('click', (e) => {
  const b = e.target.closest('.foto-x');
  if (!b) return;
  fotosSel.splice(Number(b.dataset.fidx), 1);
  renderFotosSel();
});

inputArquivos.addEventListener('change', () => {
  for (const f of inputArquivos.files) {
    const ext = extDo(f.name);
    if (!EXT_OCR.includes(ext)) {
      toast(`"${f.name}" não é aceito. Use PowerPoint ou imagem.`, 'error');
      continue;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast(`"${f.name}" excede ${MAX_MB} MB.`, 'error');
      continue;
    }
    const existe = selecionados.some((s) => s.name === f.name && s.size === f.size);
    if (!existe) selecionados.push(f);
  }
  inputArquivos.value = '';
  renderLista();
});

listaArquivos.addEventListener('click', (e) => {
  const btn = e.target.closest('.file-chip-x');
  if (!btn) return;
  selecionados.splice(Number(btn.dataset.idx), 1);
  renderLista();
});

formPub.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = document.getElementById('pub-nome').value.trim();
  const preco = document.getElementById('pub-preco').value.trim();
  const descricao = document.getElementById('pub-desc').value.trim();
  const precoNum = Number(preco.replace(/\./g, '').replace(',', '.'));

  if (titulo.length < 2) return toast('Informe o título do material.', 'error');
  if (!preco || !Number.isFinite(precoNum) || precoNum <= 0) return toast('Informe um preço válido (ex.: 49,90).', 'error');
  if (!selecionados.length) return toast('Adicione pelo menos um arquivo.', 'error');

  const btn = formPub.querySelector('button[type="submit"]');
  const rotulo = btn.querySelector('.btn-text');
  btn.disabled = true;
  rotulo.textContent = 'Publicando…';

  const fd = new FormData();
  fd.append('titulo', titulo);
  fd.append('preco', String(precoNum.toFixed(2)));
  if (descricao) fd.append('descricao', descricao);
  selecionados.forEach((f) => fd.append('arquivos', f));
  fotosSel.forEach((f) => fd.append('fotos', f));

  try {
    await api.postForm('/api/admin/materiais', fd);
    toast('Material publicado com sucesso!', 'success');
    formPub.reset();
    selecionados = [];
    fotosSel = [];
    renderLista();
    renderFotosSel();
    carregarLista();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    rotulo.textContent = 'Publicar material';
  }
});

/* ---------------- Ações da tabela ---------------- */
wrap.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-acao]');
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.acao === 'excluir') {
    const ok = await showModal({
      titulo: 'Excluir material',
      corpo: '<p>Tem certeza? Os arquivos serão removidos. Materiais com vendas não podem ser excluídos.</p>',
      okLabel: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/admin/materiais/${id}`);
      toast('Material excluído.', 'success');
      carregarLista();
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  if (btn.dataset.acao === 'editar') abrirModalEdicao(id);
});

function fotosAtuaisHtml(fotos = []) {
  if (!fotos.length) return '<span class="muted small">Nenhuma foto de anúncio ainda.</span>';
  return fotos
    .map((f, i) => `<div class="foto-item"><img src="${f.url}" alt="" />
      <button type="button" class="foto-x" data-fid="${f.id}" aria-label="Remover foto">×</button>${i === 0 ? '<span class="foto-tag">CAPA</span>' : ''}</div>`)
    .join('');
}

function abrirModalEdicao(id) {
  api
    .get('/api/admin/materiais')
    .then(({ materiais }) => {
      const m = materiais.find((x) => x.id === id);
      if (!m) return toast('Material não encontrado.', 'error');
      const root = document.getElementById('modal-root');
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ed-titulo">
          <h3 id="ed-titulo">Editar material</h3>
          <div class="modal-corpo">
            <div class="field"><label for="ed-nome">Título</label><input id="ed-nome" type="text" value="${escapeHtml(m.titulo)}" /></div>
            <div class="field"><label for="ed-preco">Preço (R$)</label><input id="ed-preco" type="text" inputmode="decimal" value="${String(m.preco).replace('.', ',')}" /></div>
            <div class="field"><label for="ed-desc">Descrição</label><textarea id="ed-desc" rows="3">${escapeHtml(m.descricao || '')}</textarea></div>
            <div class="field">
              <label for="ed-fotos">Fotos do anúncio</label>
              <div class="foto-grid" id="ed-fotos-atuais">${fotosAtuaisHtml(m.fotos)}</div>
              <input id="ed-fotos" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.avif" style="margin-top:10px" />
              <p class="field-hint">As fotos novas são enviadas ao salvar. A primeira foto é a capa.</p>
            </div>
          </div>
          <div class="modal-acoes">
            <button type="button" class="btn btn-ghost" data-act="cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" data-act="ok"><span class="btn-text">Salvar</span></button>
          </div>
        </div>`;
      root.appendChild(overlay);
      overlay.querySelector('[data-act="ok"]').focus();

      const fecha = () => {
        overlay.remove();
        document.removeEventListener('keydown', esc);
      };
      const esc = (ev) => {
        if (ev.key === 'Escape') fecha();
      };
      document.addEventListener('keydown', esc);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) fecha();
      });
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', fecha);
      overlay.querySelector('#ed-fotos-atuais').addEventListener('click', async (ev) => {
        const x = ev.target.closest('[data-fid]');
        if (!x) return;
        try {
          await api.del(`/api/admin/fotos/${x.dataset.fid}`);
          x.closest('.foto-item').remove();
          toast('Foto removida.', 'success');
          carregarLista();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      overlay.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const okBtn = overlay.querySelector('[data-act="ok"]');
        const rotulo = okBtn.querySelector('.btn-text');
        okBtn.disabled = true;
        rotulo.textContent = 'Salvando…';
        try {
          await api.put(`/api/admin/materiais/${id}`, {
            titulo: overlay.querySelector('#ed-nome').value.trim(),
            preco: overlay.querySelector('#ed-preco').value.trim(),
            descricao: overlay.querySelector('#ed-desc').value.trim(),
          });
          const novas = aceitaFotos(overlay.querySelector('#ed-fotos').files);
          if (novas.length) {
            const fd = new FormData();
            novas.slice(0, 10).forEach((f) => fd.append('fotos', f));
            await api.postForm(`/api/admin/materiais/${id}/fotos`, fd);
          }
          toast('Material atualizado.', 'success');
          fecha();
          carregarLista();
        } catch (err) {
          toast(err.message, 'error');
          okBtn.disabled = false;
          rotulo.textContent = 'Salvar';
        }
      });
    })
    .catch((err) => toast(err.message, 'error'));
}

/* ---------------- Init com guarda de admin ---------------- */
(async function init() {
  await loadUser();
  renderHeader();
  renderFooter();

  if (!state.user) {
    location.href = '/login?next=%2Fadmin';
    return;
  }
  if (state.user.role !== 'ADMIN') {
    toast('Acesso restrito ao administrador.', 'error');
    setTimeout(() => {
      location.href = '/';
    }, 1400);
    return;
  }
  carregarLista();
})();
