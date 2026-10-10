/* Inicialização segura: prepara o banco e o front, depois sobe o servidor.
   Usado por "npm start" (preview, Hostinger e produção local).
   Cada etapa que falhar é avisada, mas o servidor tenta subir mesmo assim. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Carrega o .env e define DATABASE_URL padrao ANTES de chamar o Prisma CLI
// (o CLI nao passa pelo env.js; sem isso, sem .env ele falha com P1012).
require('../src/lib/env');

const backend = path.join(__dirname, '..');
const raiz = path.join(backend, '..');
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';
const npm = isWin ? 'npm.cmd' : 'npm';

function rodar(titulo, cmd, args, cwd) {
  console.log(`[iniciar] ${titulo}...`);
  let r;
  if (cmd === process.execPath) {
    // node.exe e um executavel de verdade: sem shell, entao o espaco em
    // "C:\\Program Files\\nodejs" nao quebra o comando.
    r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  } else if (isWin) {
    // npx.cmd / npm.cmd precisam de shell no Windows. Comando unico em string
    // (sem passar args), o que evita o aviso DEP0190 do Node.
    r = spawnSync([cmd, ...args].join(' '), { cwd, stdio: 'inherit', shell: true, env: process.env });
  } else {
    r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  }
  if (r.error) console.warn(`[iniciar] erro ao executar "${titulo}":`, r.error.message);
  if (r.status !== 0) console.warn(`[iniciar] AVISO: "${titulo}" terminou com erro (codigo ${r.status}).`);
  return r.status === 0;
}

// 1) Prisma Client (necessário, senão o servidor cai ao iniciar)
rodar('Gerando Prisma Client', npx, ['prisma', 'generate'], backend);

// 2) Banco: aplica as migrations; se falhar, cria as tabelas direto do schema
if (!rodar('Aplicando migrations', npx, ['prisma', 'migrate', 'deploy'], backend)) {
  rodar('Criando tabelas (db push)', npx, ['prisma', 'db', 'push', '--skip-generate'], backend);
}

// 3) Seed (admin + demo) — seguro para rodar várias vezes
rodar('Seed', process.execPath, ['prisma/seed.js'], backend);

// 4) Front-end: gera o build do Vite se não existir ou se o código-fonte for mais novo
function maisRecente(dir) {
  let max = 0;
  for (const nome of fs.readdirSync(dir)) {
    if (nome === 'dist' || nome === 'node_modules') continue;
    const abs = path.join(dir, nome);
    const st = fs.statSync(abs);
    max = Math.max(max, st.isDirectory() ? maisRecente(abs) : st.mtimeMs);
  }
  return max;
}
const frontDir = path.join(raiz, 'frontend');
const distIndex = path.join(frontDir, 'dist', 'index.html');
if (!fs.existsSync(distIndex) || maisRecente(frontDir) > fs.statSync(distIndex).mtimeMs) {
  rodar('Construindo o front-end (Vite)', npm, ['run', 'build', '--workspace', 'frontend'], raiz);
}

// 5) Servidor
require('../src/server.js');
