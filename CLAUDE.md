---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

# FincasYa v2 — Agente WhatsApp (este proyecto)

Agente conversacional RAG sobre Convex (proyecto `prueba` / `modest-husky-871`).
Arquitectura completa: `docs/ARQUITECTURA.md`. Contexto extendido:
`~/Documents/AI-Memory/02_Projects/FincasYa/fincasya-prueba.md`.

- `convex/agent.ts` — orquestador + tools (capa 1 y 4)
- `convex/exemplars.ts` + `convex/curation.ts` — RAG curado (capa 2)
- `convex/lib/prompts.ts` — identidad y políticas (capa 3)
- `convex/http.ts` + `convex/inbound.ts` — webhook YCloud
- Desplegar: `bunx convex dev --once`. Curar: `bunx convex run curation:curateHistory`
  y `bunx convex run curation:embedPending`.
- REGLA: solo entra al RAG lo etiquetado venta/positiva; lo problemático jamás.

## Estructura monorepo (Turborepo, 2026-07-10)

- `bun run dev` en la raíz corre TODO (turbo): `packages/backend` (convex dev)
  + `apps/web` (Next.js, puerto 3789).
- `packages/backend` — la API: todo el código Convex (agente, curación, inbox,
  webhook YCloud). Comandos convex SIEMPRE desde aquí.
- `apps/web` — el front: Next.js (App Router) + React 19 + Tailwind 4 + shadcn.
  Rutas: `/` landing pública (réplica fincasya.com, `src/features/landing`) y
  `/inbox` panel de operadores estilo WhatsApp (`src/features/inbox`). Importa
  la API generada via `@fincasya/backend/convex/_generated/api`; el cliente
  Convex vive en `src/app/providers.tsx` (NEXT_PUBLIC_CONVEX_URL).
- Gotcha: ambos packages necesitan `@types/node` (por `process.env`); sin él,
  `convex dev` NO despliega (falla typecheck silenciosamente dentro de turbo).
