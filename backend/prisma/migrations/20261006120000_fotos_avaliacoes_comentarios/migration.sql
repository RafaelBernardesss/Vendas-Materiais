-- CreateTable
CREATE TABLE "MaterialFoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materialId" INTEGER NOT NULL,
    "caminhoRelativo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialFoto_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materialId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Avaliacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Avaliacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materialId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comentario_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comentario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialFoto_caminhoRelativo_key" ON "MaterialFoto"("caminhoRelativo");

-- CreateIndex
CREATE INDEX "MaterialFoto_materialId_idx" ON "MaterialFoto"("materialId");

-- CreateIndex
CREATE INDEX "Avaliacao_materialId_idx" ON "Avaliacao"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_userId_materialId_key" ON "Avaliacao"("userId", "materialId");

-- CreateIndex
CREATE INDEX "Comentario_materialId_createdAt_idx" ON "Comentario"("materialId", "createdAt");
