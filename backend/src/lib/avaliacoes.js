const prisma = require('./prisma');

/** Resumo de notas de um material: média, total e distribuição 1..5. */
async function resumoNotas(materialId) {
  const grupos = await prisma.avaliacao.groupBy({
    by: ['nota'],
    where: { materialId },
    _count: { _all: true },
  });
  const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let soma = 0;
  for (const g of grupos) {
    distribuicao[g.nota] = g._count._all;
    total += g._count._all;
    soma += g.nota * g._count._all;
  }
  return { media: total ? Math.round((soma / total) * 10) / 10 : 0, total, distribuicao };
}

/** Garante (booleano) que o usuário tem compra paga do material. */
async function usuarioComprou(userId, materialId) {
  const item = await prisma.orderItem.findFirst({
    where: { materialId, status: 'PAID', order: { userId, status: 'PAID' } },
    select: { id: true },
  });
  return !!item;
}

module.exports = { resumoNotas, usuarioComprou };
