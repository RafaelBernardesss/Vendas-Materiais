const { PrismaClient } = require('@prisma/client');

// Singleton do cliente Prisma
const prisma = new PrismaClient();

module.exports = prisma;
