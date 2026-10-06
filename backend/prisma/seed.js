/* Seed: cria o admin (ADMIN_EMAIL/ADMIN_PASSWORD) e, se a loja estiver
   vazia e os arquivos demo existirem em uploads/demo, publica 4 materiais
   de demonstração. Seguro para rodar várias vezes. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

// Garante SQLite mesmo que a plataforma injete outra DATABASE_URL
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

const DEMO = [
  {
    titulo: 'Pitch Deck — 10 Slides Prontos',
    preco: 49.9,
    descricao:
      'Apresentação completa para apresentar sua startup: problema, solução, mercado, produto, modelo de negócio e pedido. Layout escuro premium, 100% editável no PowerPoint.',
    capa: 'capa-pitch.jpg',
    arquivos: ['pitch-deck.pptx'],
  },
  {
    titulo: 'Relatório Semestral — PPT Corporativo',
    preco: 39.9,
    descricao:
      'Template de relatório semestral com tabelas, gráficos editáveis e slides de indicadores. Perfeito para reuniões de gestão e apresentações para investidores.',
    capa: 'capa-relatorio.jpg',
    arquivos: ['relatorio-semestral.pptx'],
  },
  {
    titulo: 'Pack de Ícones Flat (PNG)',
    preco: 29.9,
    descricao:
      'Conjunto de ícones em estilo flat com fundo transparente, prontos para slides, posts e materiais de marca. Alto contraste, uso livre em projetos.',
    capa: 'capa-icones.jpg',
    arquivos: ['icon-1.png', 'icon-2.png'],
  },
  {
    titulo: 'Pack de Texturas Papel (JPG)',
    preco: 19.9,
    descricao:
      'Texturas de papel de alta resolução para dar acabamento artesanal aos seus slides e artes. Sem marcas d\u2019água, uso ilimitado.',
    capa: 'capa-texturas.jpg',
    arquivos: ['textura-1.jpg', 'textura-2.jpg'],
  },
];

function mimeDe(nome) {
  const ext = path.extname(nome).toLowerCase();
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
  if (ext === '.png') return 'image/png';
  return 'image/jpeg';
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@slidehub.com').toLowerCase();
  const adminSenha = process.env.ADMIN_PASSWORD || 'Admin@1234';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      nome: 'Administrador',
      email: adminEmail,
      senha: await bcrypt.hash(adminSenha, 10),
      dataNascimento: new Date('1990-01-01T00:00:00Z'),
      role: 'ADMIN',
    },
  });
  console.log(`[seed] Admin pronto: ${adminEmail}`);

  const total = await prisma.material.count();
  if (total > 0) {
    console.log(`[seed] Loja já tem ${total} material(is) — demo ignorada.`);
    return;
  }

  const demoDir = path.join(UPLOAD_DIR, 'demo');
  if (!fs.existsSync(demoDir)) {
    console.log('[seed] Sem pasta de demo (uploads/demo). Loja vaziada; use o painel admin para publicar.');
    return;
  }

  for (const d of DEMO) {
    const arquivos = d.arquivos.filter((f) => fs.existsSync(path.join(demoDir, f)));
    if (!arquivos.length) continue;

    await prisma.material.create({
      data: {
        titulo: d.titulo,
        preco: d.preco,
        descricao: d.descricao,
        arquivoCapa: path.join('demo', d.capa),
        arquivos: {
          create: arquivos.map((f) => ({
            nomeArquivo: f,
            caminhoRelativo: path.join('demo', f),
            tipo: /\.(ppt|pptx)$/i.test(f) ? 'PPTX' : 'IMAGEM',
            tamanho: fs.statSync(path.join(demoDir, f)).size,
            mime: mimeDe(f),
          })),
        },
      },
    });
    console.log(`[seed] Demo: ${d.titulo}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('[seed] Erro:', err);
    process.exit(1);
  });
