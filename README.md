# e-invoice-play

Monorepo **pnpm**: simulador fiscal (NF-e / CT-e) — **Next.js 15** (`frontend/`) + **Fastify** (`backend/`) + **PostgreSQL** via Prisma.

## Requisitos

- Node 20+
- [pnpm](https://pnpm.io) 9
- [Docker](https://docs.docker.com/get-docker/) (para PostgreSQL local)

## Comandos

| Comando | Descrição |
|--------|-----------|
| `pnpm install` | Instala dependências de todos os pacotes |
| `pnpm dev` | API (3001) + Next.js (3000) em paralelo |
| `pnpm dev:frontend` | Só Next.js (precisa da API rodando) |
| `pnpm dev:backend` | Só API Fastify (http://localhost:3001) |
| `pnpm build` | Build de `frontend` e `backend` |
| `pnpm lint` | ESLint do pacote `frontend` |
| `pnpm format` | Prettier na raiz |
| `pnpm docker:up` | Sobe PostgreSQL em container |
| `pnpm docker:down` | Para os containers |
| `pnpm docker:logs` | Logs do Postgres |
| `pnpm docker:reset` | Remove containers e volume de dados |
| `pnpm db:setup` | `docker:up` + migrations + seed |

## Estrutura

- `frontend/` — UI (App Router, Tailwind v4, mocks e gerador XML de simulação).
- `backend/` — API REST (`/api/health`, …) e `prisma/` (schema inicial).
- `docs/` — notas de refatoração e arquitetura.

## Banco (Docker)

1. `cp .env.example .env` e `cp backend/.env.example backend/.env` (mesma `DATABASE_URL`).
2. `pnpm docker:up` — Postgres em `localhost:5432` (user/senha/db: `einvoice` / `einvoice` / `e_invoice_play`).
3. `pnpm --filter @e-invoice-play/backend db:migrate:deploy` e `pnpm --filter @e-invoice-play/backend db:seed`, ou em um passo: `pnpm db:setup`.

Para criar novas migrations em desenvolvimento: `pnpm --filter @e-invoice-play/backend db:migrate` (`prisma migrate dev`).

Variáveis: `backend/.env` precisa de `DATABASE_URL` apontando para o Postgres (local ou container).
