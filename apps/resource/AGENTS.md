# apps/resource

FiveM resource (client + server) that bridges a running FXServer to the panel, plus its NUI in `web/`.

## Build model

- `scripts/build.js` bundles `src/server` (Node 22, CJS) and `src/client` (browser, IIFE) with esbuild through `@overextended/fx-utils`, copies `static/` and `locales/`, builds the NUI with Vite, and **regenerates `fxmanifest.lua`**. Treat the manifest as build output; do not hand-edit it.
- Build labels select the runtime: `$SERVER`, `$CLIENT`, `$BROWSER`, `$DEV`. Wrap one-sided code in the matching label; production builds drop `$DEV`.
- `dist/` is generated and ignored. `static/config.json` is runtime configuration read by `src/common/config.ts`.

## Layout

- `src/server/` — entry `index.ts`: txAdmin compatibility, game events, exports, HTTP handler, monitoring and utilities.
- `src/client/` — client entry.
- `src/common/` — shared config, locale and types.
- `web/` — NUI (React + Vite), served from `dist/web` in production and `http://localhost:5175` during NUI development.

## Panel communication

- Use `QueryManager` (`src/server/utils/query.ts`): it calls `/internal/*` on `127.0.0.1` with the `x-resource-token` header. Never call `/api/*` and never hard-code the token.
- The token comes from the `resource-api-token` convar, is validated as a UUID at load and is censored with `SetConvar` after boot. Keep it that way: no logging, and never pass it to the client or NUI.
- Payload types come from `@fxmanager/shared/types`. Validate external input with the existing zod schemas/helpers rather than trusting event arguments.
- `QueryManager` throws when the panel is unavailable. Callers decide whether to log, retry or degrade; a panel outage must not break game events.

## Commands

- From this package: `bun run dev` (watch build), `bun run build` (production bundle), `bun run web:dev` (NUI on `:5175`), `bun run deploy` (copies to `DEPLOY_PATH`).
- `bun run deploy` writes outside the repository; only run it when the developer asks.
- `bun run build` and `bun run dev` refresh `fxmanifest.lua`; commit a manifest change only when it is part of the task.
- Root `bun dev` starts this watcher as part of Turbo.

## Tests

- `bun test apps/resource/src/server/`. FiveM globals do not exist under Bun: stub `GetConvar`, `GetConvarInt`, `SetConvar`, `DropPlayer` and friends on `globalThis` **before** the dynamic `import()` of the module under test, then restore them in `afterEach` (see `monitoring/players.test.ts`).
- Prefer testing pure parsing, formatting and query helpers over code that needs a live server.
- Biome covers TypeScript here; Lua and SQL follow `.editorconfig` (tabs).
