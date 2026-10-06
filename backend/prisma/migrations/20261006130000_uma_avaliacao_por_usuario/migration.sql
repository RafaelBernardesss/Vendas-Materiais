-- Um comentário por usuário em cada material.
-- Antes de criar o índice único, remove duplicados antigos (mantém o mais antigo de cada par),
-- senão a criação do índice falharia em bancos que já têm vários comentários do mesmo usuário.
DELETE FROM "Comentario"
WHERE "id" NOT IN (
    SELECT MIN("id") FROM "Comentario" GROUP BY "userId", "materialId"
);

-- CreateIndex
CREATE UNIQUE INDEX "Comentario_userId_materialId_key" ON "Comentario"("userId", "materialId");
