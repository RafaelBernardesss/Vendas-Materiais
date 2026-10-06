# SlideHub — Loja de Materiais Digitais

Venda de materiais digitais (arquivos **PowerPoint** e **imagens**) com pagamento via **Pix**,
download protegido por conta, painel administrativo e deploy em **uma única aplicação Node.js**.

| Camada | Stack |
| --- | --- |
| Banco de dados | **SQLite + Prisma ORM** (schema + migrations + seed) |
| Back-end | **Node.js + Express** (controllers, routes, middlewares, services) |
| Front-end | **HTML + CSS + JS puro** com **Vite** (multi-page, sem framework) |
| Pagamento | **Mercado Pago (Pix)** + modo de simulação (`PAYMENT_MODE=mock`) |
| Segurança | Helmet, CORS, rate limit, JWT em cookie httpOnly, bcrypt, Zod |

---

## 1. Estrutura de pastas

```
.
├── package.json                  # raiz: workspaces + scripts (build/dev/start)
├── tsconfig.json
├── .gitignore
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example              # copie para .env e ajuste
│   ├── prisma/
│   │   ├── schema.prisma         # User, Material, MaterialFile, CartItem, Order, OrderItem
│   │   ├── migrations/           # migrations versionadas (prisma migrate deploy)
│   │   └── seed.js               # admin (env) + materiais de demo (se existirem)
│   ├── scripts/
│   │   └── gerar-demo.js         # gera .pptx de demonstração em uploads/demo
│   ├── uploads/                  # arquivos dos materiais (NÃO é pública)
│   │   ├── arquivos/             # uploads do admin (naming seguro via multer)
│   │   └── demo/                 # arquivos de demonstração
│   └── src/
│       ├── server.js             # servidor Express (também serve o dist do Vite)
│       ├── controllers/          # auth, materiais, carrinho, pagamentos, downloads, admin
│       ├── routes/               # uma rota por domínio
│       ├── middlewares/          # auth JWT, admin, upload (multer), validate (zod),
│       │                         # rate limit, error handler
│       ├── services/             # pix (Mercado Pago + mock), cpf
│       └── lib/                  # env, prisma, erros, caminhos de arquivo
└── frontend/
    ├── package.json
    ├── vite.config.js            # multi-page + proxy /api para o Express em dev
    ├── index.html                # vitrine
    ├── login.html
    ├── cadastro.html
    ├── carrinho.html
    ├── checkout.html             # Pix: QR Code + copia-e-cola + polling
    ├── meus-materiais.html       # downloads protegidos (arquivo ou .zip)
    ├── admin.html                # painel do admin
    └── src/
        ├── css/styles.css        # design system
        └── js/
            ├── api.js            # cliente HTTP com cookies
            ├── ui.js             # header, footer, toasts, modais, skeleton, estado
            ├── main.js           # vitrine (Comprar / No carrinho / Download)
            ├── login.js
            ├── cadastro.js
            ├── carrinho.js
            ├── checkout.js
            ├── meus-materiais.js
            └── admin.js
```

---

## 2. Rodando localmente (Windows)

Pré-requisito: **Node.js 18.18+** (recomendado 20 LTS) — https://nodejs.org

```powershell
# 1) Instalar dependências (workspaces: raiz + backend + frontend)
npm install

# 2) Criar o .env do backend
copy backend\.env.example backend\.env
# edite o backend\.env:
#   - PAYMENT_MODE=mock  (teste sem credenciais)
#   - JWT_SECRET         (gere com: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
#   - PORT=3000          (o proxy do Vite aponta para 3000)

# 3) Criar o banco + migration + seed (admin)
npm run db:migrate --workspace backend

# 4) (opcional) gerar os PPTX de demonstração
npm run demo:files --workspace backend

# 5) Sobe API (3000) + Vite (5173) juntos
npm run dev
```

Acesse **http://localhost:5173**.

**Modo produção local** (Express servindo o build do Vite, igual à Hostinger):

```powershell
# no backend\.env use PORT=3000
npm run build
npm start
# → http://localhost:3000
```

**Contas de teste**
- Admin (criado pelo seed): `admin@slidehub.com` / `Admin@1234` (troque no `.env`)
- Clientes: crie em `/cadastro`
- CPF válido para o checkout: `111.444.777-35`

### Testando o fluxo completo (com `PAYMENT_MODE=mock`)

1. **Cadastro** — `/cadastro`: nome, e-mail, senha (mín. 8), confirmação e nascimento.
   Você já entra logado e cai na página inicial com a vitrine.
2. **Comprar** — clique em **Comprar** num card → vira **No carrinho** e o contador do
   header incrementa.
3. **Carrinho** — `/carrinho`: remova itens, veja o total, clique em **Continuar para o pagamento**.
4. **Checkout** — informe nome completo + CPF (com máscara e validação real de dígitos).
   Clique em **Gerar cobrança Pix** → aparece **QR Code** e **copia-e-cola**.
5. **Aprovar** — em modo mock, use o botão **Simular pagamento aprovado** (em produção,
   o webhook do Mercado Pago confirma sozinho). O status é verificado por polling a cada 3 s.
6. **Download** — com o pagamento confirmado, o botão da vitrine vira **Download** e o
   material aparece em `/meus-materiais` (arquivo individual ou `.zip` com tudo).
7. **Admin** — entre com a conta admin → você é redirecionado para `/admin`:
   publique material (título, preço, descrição + múltiplos arquivos; a primeira
   imagem vira a capa), edite e exclua. A coluna **Vendas** conta compras pagas.

### Para vender de verdade (Mercado Pago)

1. Crie/acesse uma conta em **https://www.mercadopago.com.br/developers**.
2. Em **Projetos → Suas integrações → Criar aplicação**, copie o **Access Token**
   de produção (começa com `APP_USR-...`).
3. No painel do Mercado Pago, em **Webhooks**, crie um webhook com a URL:
   `https://SEU-SITE/api/pagamentos/webhooks/pix` e copie o **segredo do webhook**.
4. No `backend/.env`:
   ```env
   PAYMENT_MODE=mp
   MP_ACCESS_TOKEN=APP_USR-...
   MP_WEBHOOK_SECRET=segredo-do-webhook
   PUBLIC_URL=https://seu-site.com
   COOKIE_SECURE=true
   ```
   A API valida a assinatura `x-signature` do webhook, confirma consultando o
   provedor (não confia no corpo) e é idempotente (pedido já pago não é reprocessado).

---

## 3. Variáveis de ambiente (backend/.env)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PORT` | não | Porta do Express (a Hostinger injeta automaticamente). Dev: `3000` |
| `DATABASE_URL` | sim | Caminho do SQLite. Ex.: `file:./dev.db` ou `file:/home/usuario/slidehub/slidehub.db` |
| `JWT_SECRET` | sim (produção) | Segredo do token JWT. Use string longa e aleatória |
| `ADMIN_EMAIL` | não | E-mail do admin criado no seed (padrão `admin@slidehub.com`) |
| `ADMIN_PASSWORD` | sim (produção) | Senha do admin (mín. 8 caracteres) |
| `PAYMENT_MODE` | não | `mock` (simulação, desenvolvimento) ou `mp` (Mercado Pago) |
| `MP_ACCESS_TOKEN` | se `mp` | Access Token do Mercado Pago (`APP_USR-...`) |
| `MP_WEBHOOK_SECRET` | se `mp` | Segredo do webhook criado no painel do Mercado Pago |
| `PUBLIC_URL` | sim (produção) | URL pública do site (webhook + CORS) |
| `FRONTEND_URL` | não | Origem do Vite em dev (`http://localhost:5173`) |
| `UPLOAD_DIR` | não | Pasta de uploads. Vazio = `backend/uploads`. Use caminho persistente em produção |
| `UPLOAD_MAX_SIZE_MB` | não | Tamanho máximo por arquivo (padrão `25`) |
| `COOKIE_SECURE` | sim (produção) | `true` quando o site usa HTTPS |

---

## 4. Publicando na Hostinger (Hospedagem Node.js / VPS)

A aplicação é **uma única app Node.js**: o Express sobe a API **e** serve o build
do Vite (`frontend/dist`), ouvindo em `process.env.PORT`.

### Opção A — "Node.js App" do hPanel (recomendado)

1. **hPanel → Node.js Apps → Create Application**
   - Node.js version: **20+**
   - Application root: a pasta onde você subiu o projeto (ex.: `/`)
   - Application URL: seu domínio/subdomínio
   - Entry point: **`backend/src/server.js`**
2. **Suba o código** (sem `node_modules`):
   - por **Git** (clona/repo) ou **zip** via Gerenciador de Arquivos e descompacte na raiz.
   - Dica: nunca versione o `.env` — crie o `.env` pelo hPanel.
3. **Variáveis de ambiente** (aba *Environment Variables* do Node.js App):
   crie todas da tabela acima. Mínimo essencial:
   ```
   DATABASE_URL=file:/home/SEU_USUARIO/slidehub-data/slidehub.db
   JWT_SECRET=<aleatório longo>
   ADMIN_EMAIL=seu@email.com
   ADMIN_PASSWORD=<forte>
   PAYMENT_MODE=mp
   MP_ACCESS_TOKEN=APP_USR-...
   MP_WEBHOOK_SECRET=...
   PUBLIC_URL=https://seudominio.com
   UPLOAD_DIR=/home/SEU_USUARIO/slidehub-data/uploads
   UPLOAD_MAX_SIZE_MB=25
   COOKIE_SECURE=true
   ```
   Crie a pasta `slidehub-data` (banco + uploads) **fora** da pasta do app, para
   ela sobreviver a redeploys.
4. **Comandos de build/instalacao** (campos *Install command* e *Build command*):
   - Install: `npm install`
   - Build: `npm run build`
     (gera o Prisma Client, aplica as migrations com `prisma migrate deploy`,
     roda o seed idempotente e constrói o Vite em `frontend/dist`)
5. **Deploy** → o hPanel roda install + build e inicia com `npm start`
   (que é `node backend/src/server.js` na pasta `backend`).
6. **Webhook do Pix** — no Mercado Pago, aponte para
   `https://seudominio.com/api/pagamentos/webhooks/pix`.
7. **Teste**: `/api/health` deve responder `{"ok":true,...}`; crie uma conta,
   compre um material com Pix real e confira a liberação automática do download.

> O seed é idempotente: em cada deploy ele garante o admin e só cria os materiais
> de demo quando a loja está vazia e os arquivos de demo existem.

### Opção B — VPS (panel clássico)

```bash
# no servidor, dentro da pasta do projeto
cp backend/.env.example backend/.env   # ajuste os valores
npm install
npm run build
# use PM2:
npm i -g pm2
pm2 start backend/src/server.js --name slidehub --cwd backend
pm2 save && pm2 startup
```

---

## 5. Segurança — o que está implementado

- **Senhas** com bcrypt (10 rounds); respostas nunca incluem senha, token ou
  caminho interno de arquivo.
- **JWT em cookie httpOnly** (7 dias, `SameSite=Lax`, `Secure` em HTTPS).
- **Rotas protegidas**: `requireAuth` (cliente) e `requireAdmin` (admin).
- **Download protegido**: exige `OrderItem` com status `PAID` do próprio usuário;
  arquivos ficam fora da pasta pública e são servidos por rota autenticada
  (individual ou `.zip`), com proteção contra path traversal.
- **Rate limit** em login (20/15 min) e cadastro (5/15 min) por IP.
- **Helmet** + CORS restrito (`PUBLIC_URL`/`FRONTEND_URL`) + cookies seguros.
- **Validação de entrada** com Zod (API) e validação equivalente no front.
- **Upload** com multer: extensão + tamanho máx. configurável, até 20 arquivos.
- **Webhook Pix**: validação de assinatura (HMAC SHA-256), status conferido no
  provedor, **idempotente** (pedido já PAID não libera duas vezes).
- **CPF**: validado nos dígitos verificadores (front + back); guardado no pedido,
  nunca exposto a outros usuários.


---

## Novidades

- **Página do material** (`/produto?id=N`): galeria com todas as fotos, descrição, lista do que vem no pacote, botão de comprar/download.
- **Fotos do anúncio** (admin): campo "Fotos do anúncio" ao publicar (a primeira vira a capa) e, em **Editar**, é possível adicionar/remover fotos. Os arquivos que o cliente baixa continuam no campo "Arquivos do material".
- **Avaliações** (1 a 5 estrelas): somente quem comprou avalia (uma nota por pessoa, pode alterar).
- **Comentários**: qualquer usuário logado comenta; aparece o selo "Compra verificada"; autor e admin podem excluir.
- Nova migration: `20261006120000_fotos_avaliacoes_comentarios` (aplicada automaticamente pelo `npm start`).
