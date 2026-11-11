# apps/core

Fastify 5 service that owns the panel API, WebSocket channels, authentication and the FXServer process. Entrypoint: `src/index.ts`.

## Boot order

`src/index.ts` is the only place that composes the system: it loads `.env` in development (`src/common/env.ts`), applies migrations, reads `ConfigManager`, registers Fastify plugins, starts `perfManager`, `sessionManager` and `restartScheduler`, registers `/api` and `/internal`, then listens and optionally autostarts FXServer.

- Do not start timers, listeners or child processes as an import side effect. Start them from the composition point or from the owning manager's explicit `start()`.
- Shutdown stops the supervised FXServer before closing Fastify (`SIGTERM`/`SIGINT` handlers exist for this). Keep new resources in that path.
- A failed autostart must never take the panel down; the existing log-and-continue behaviour is deliberate.

## Layout

- `src/common/` — cross-cutting helpers: env loading, utilities, version checks, FXServer paths.
- `src/middleware/` — Fastify preHandlers: `sessionAuth` for the panel cookie, resource-token auth, loopback guard.
- `src/modules/<domain>/` — runtime logic in `manager.ts` with a sibling `*.test.ts`. Domains include ace, auth, buffer, config, disconnect, discord, game, perf, process, resource, schedule, session, setup and txadmin.
- `src/routes/api/` — panel endpoints (`/api/*`); `src/routes/internal/` — resource endpoints (`/internal/*`).
- `src/types` — route, request and module types.

## Routes

- Each route module exports `{ prefix, handler } satisfies RouteModule` and is registered in `src/routes/api/index.ts` or `src/routes/internal/index.ts`. Only infrastructure routes (health, dev-only helpers) belong directly in `src/index.ts`.
- Panel route modules mount `fastify.addHook('preHandler', sessionAuth)` and check permissions per handler with `PermissionManager.has(admin.permissions, UserPermissions.X)`, replying `403 { error: 'Not authorized' }` on failure. Read the admin from `request as AuthedRequest`; never trust a client-supplied identity.
- Internal routes exist for `apps/resource` only and authenticate with the resource token. Never expose internal behaviour under `/api`.
- Match existing response shapes: `{ error: string }` on failure, DTOs from `@fxmanager/shared/types` on success, with explicit status codes.
- Validate untrusted input before acting (resource names, player ids, schedule times, filesystem paths) with helpers from `@fxmanager/shared/utils`.

## Managers

- Long-lived state is a class singleton (`getInstance()`) or an exported instance; keep the pattern used by the domain you touch.
- Inject time and intervals so tests avoid waiting: `RestartScheduler.start(pm, { tickMs })`, `tick(now)`, `getStatus(now)`. Call `.unref()` on timers.
- Talk to persistence through `repo` from `@fxmanager/database`; no SQL in this app.

## Development and tests

- Root `bun dev` runs this package with `--watch`. Core listens on `PANEL_PORT`, falling back to `3000`; the webpanel proxy expects `3000` locally. `/routemap` lists routes in development only.
- Tests: `bun test apps/core/src/modules/<domain>/manager.test.ts`. Mock collaborators (process manager, repositories, timers) instead of spawning FXServer, and keep cases deterministic.
- This package runs Biome and `tsc --noEmit` through its own scripts. For a change, run `bunx biome check --write <changed paths>` from the root so untouched files are not reformatted.
