/* Gera os arquivos PowerPoint de demonstração (pitch-deck.pptx e
   relatorio-semestral.pptx) em uploads/demo. As capas (imagens) devem
   existir na mesma pasta — gere-as ou publique seus próprios materiais
   pelo painel admin. Execute com: npm run demo:files --workspace backend */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

// Garante SQLite mesmo que a plataforma injete outra DATABASE_URL
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const DIR = path.join(__dirname, '..', 'uploads', 'demo');
fs.mkdirSync(DIR, { recursive: true });

const LARANJA = 'E4572E';
const TINTA = '171512';
const CRISSAL = 'F5F1EA';

async function pitchDeck() {
  const p = new PptxGenJS();
  p.author = 'SlideHub';
  p.title = 'Pitch Deck';

  const capa = p.addSlide();
  capa.background = { color: TINTA };
  capa.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.16, fill: { color: LARANJA } });
  capa.addText('PITCH DECK', {
    x: 0.7, y: 2, w: 8.6, h: 1.1, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: 'Calibri',
  });
  capa.addText('Template profissional \u2014 10 slides 100% edit\u00e1veis', {
    x: 0.72, y: 3.25, w: 8.6, h: 0.6, fontSize: 20, color: 'C9C2B6',
  });

  const secoes = [
    ['O Problema', 'Descreva a dor que seu produto resolve, com dados de mercado.'],
    ['A Solu\u00e7\u00e3o', 'Apresente seu produto em uma frase e mostre como ele elimina a dor.'],
    ['Mercado', 'TAM, SAM e SOM com fontes claras e proje\u00e7\u00f5es.'],
    ['Produto', 'Demonstra\u00e7\u00e3o, recursos principais e diferenciais.'],
    ['Modelo de Neg\u00f3cio', 'Como voc\u00ea ganha dinheiro: pre\u00e7o, canais e margem.'],
    ['Tra\u00e7\u00e3o', 'M\u00e9tricas de crescimento, reten\u00e7\u00e3o e depoimentos.'],
    ['Time', 'Fundadores e especialistas com experi\u00eancia relevante.'],
    ['Previs\u00f5es', 'Proje\u00e7\u00e3o financeira de 24 meses com premissas.'],
    ['Pedido', 'Quanto voc\u00ea busca e como o capital ser\u00e1 usado.'],
  ];
  for (const [titulo, texto] of secoes) {
    const s = p.addSlide();
    s.background = { color: CRISSAL };
    s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 5.63, fill: { color: LARANJA } });
    s.addText(titulo, { x: 0.7, y: 0.5, w: 8.6, h: 0.9, fontSize: 34, bold: true, color: TINTA });
    s.addText(texto, { x: 0.72, y: 1.7, w: 8.4, h: 1.2, fontSize: 18, color: '6E675D' });
  }

  const fim = p.addSlide();
  fim.background = { color: TINTA };
  fim.addText('Obrigado!', { x: 0.7, y: 2.2, w: 8.6, h: 1, fontSize: 44, bold: true, color: 'FFFFFF' });
  fim.addText('contato@suastartup.com', { x: 0.72, y: 3.2, w: 8.6, h: 0.5, fontSize: 18, color: 'C9C2B6' });

  await p.writeFile({ fileName: path.join(DIR, 'pitch-deck.pptx') });
  console.log('[demo] pitch-deck.pptx gerado');
}

async function relatorio() {
  const p = new PptxGenJS();
  p.author = 'SlideHub';
  p.title = 'Relat\u00f3rio Semestral';

  const capa = p.addSlide();
  capa.background = { color: '122B28' };
  capa.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.16, fill: { color: '32BCAD' } });
  capa.addText('RELAT\u00d3RIO SEMESTRAL', {
    x: 0.7, y: 2, w: 8.6, h: 1.1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Calibri',
  });
  capa.addText('Resultados, indicadores e pr\u00f3ximos passos', {
    x: 0.72, y: 3.25, w: 8.6, h: 0.6, fontSize: 20, color: 'BFD8D5',
  });

  const tabela = p.addSlide();
  tabela.background = { color: CRISSAL };
  tabela.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 5.63, fill: { color: '32BCAD' } });
  tabela.addText('Indicadores do semestre', {
    x: 0.7, y: 0.45, w: 8.6, h: 0.8, fontSize: 30, bold: true, color: TINTA,
  });
  tabela.addTable(
    [
      ['Indicador', '1\u00ba semestre', '2\u00ba semestre', 'Varia\u00e7\u00e3o'],
      ['Receita (R$)', '120.000', '158.000', '+31,7%'],
      ['Novos clientes', '42', '61', '+45,2%'],
      ['Churn mensal', '4,8%', '3,1%', '\u221235,4%'],
      ['NPS', '58', '71', '+13'],
    ],
    {
      x: 0.7, y: 1.6, w: 8.6, fontSize: 15, fontFace: 'Calibri',
      color: TINTA, border: { type: 'solid', color: 'D8D2C6', pt: 1 },
      fill: { color: 'FFFFFF' },
    }
  );

  const passos = p.addSlide();
  passos.background = { color: CRISSAL };
  passos.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 5.63, fill: { color: '32BCAD' } });
  passos.addText('Pr\u00f3ximos passos', {
    x: 0.7, y: 0.45, w: 8.6, h: 0.8, fontSize: 30, bold: true, color: TINTA,
  });
  passos.addText(
    [
      { text: '1. Lan\u00e7ar o novo plano corporativo\n', options: { bullet: false } },
      { text: '2. Expandir o time comercial para duas regi\u00f5es\n', options: {} },
      { text: '3. Reduzir o custo de aquisi\u00e7\u00e3o em 20%\n', options: {} },
      { text: '4. Iniciar a s\u00e9rie A de capta\u00e7\u00e3o', options: {} },
    ],
    { x: 0.8, y: 1.7, w: 8.4, h: 3, fontSize: 18, color: TINTA, lineSpacing: 30 }
  );

  await p.writeFile({ fileName: path.join(DIR, 'relatorio-semestral.pptx') });
  console.log('[demo] relatorio-semestral.pptx gerado');
}

(async () => {
  try {
    await pitchDeck();
    await relatorio();
    const faltantes = ['capa-pitch.jpg', 'capa-relatorio.jpg', 'capa-icones.jpg', 'capa-texturas.jpg']
      .filter((f) => !fs.existsSync(path.join(DIR, f)));
    if (faltantes.length) {
      console.log(`[demo] Capaus ausentes em ${DIR}: ${faltantes.join(', ')} (crie as imagens ou publique pelo admin)`);
    }
    console.log('[demo] Concluido.');
  } catch (err) {
    console.error('[demo] Erro:', err);
    process.exit(1);
  }
})();
