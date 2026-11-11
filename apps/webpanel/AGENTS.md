# apps/webpanel

React 19 SPA built with Vite, React Router 7, Tailwind 4 and the ShadCN primitives from `@fxmanager/ui`. Production serves the built assets from `apps/core`; in development Vite proxies `/api` and `/api/ws` to `localhost:3000`.

## Layout

- `src/pages/<area>/index.tsx` — page components, default-exported; area-specific parts sit beside them in `components/`.
- `src/components/` — app-specific components. Reusable primitives belong in `packages/ui`.
- `src/hooks/` — data hooks (`use-*.ts`); `src/hooks/ws-channels/` — socket channels.
- `src/context/` — Auth and WebSocket providers; `src/lib/` — pure helpers; `src/static/` — navigation, route and status maps.

## Adding a page

1. Create the page under `src/pages/...` and default-export it.
2. Register it in `src/pages/index.ts` with `path`, `element`, `permission` (a `UserPermissions` flag) and `auth`/`layout` flags as needed. `App.tsx` filters routes by permission and wraps them in the layout.
3. Add a sidebar entry in `src/static/navigation.ts` when the page should be navigable.

## Data and UI

- Server data comes from hooks. WebSocket-backed data must use the existing channel hooks (`use-server-state`, `use-playerlist`, `use-console`, `use-perf`, …) instead of polling. Keep `AuthContext` and `WsContext` as the single source for session and connection state.
- Session expiry and unauthenticated redirects belong to `ProtectedRoute`/`AuthContext`; do not re-implement them per page.
- Import primitives from `@fxmanager/ui/components/<name>` (plus `@fxmanager/ui/lib/utils` and shared hooks). Compose classes with `cn()` and semantic tokens (`bg-card`, `text-muted-foreground`, `--chart-*`). Keep light and dark themes working; avoid hard-coded colours and ad-hoc CSS.
- Icons come from `lucide-react`; toasts from `sonner` (or the shared `copyToClipboard` helper).
- Use the `@/` alias for `src` imports and `@fxmanager/shared/{types,constants}` for contracts.

## Testing and checks

- There is no DOM test harness. Pure logic lives in `src/lib` or beside its hook and is tested with `bun:test` (see `hooks/ws-channels/perf-merge.test.ts` and `lib/*.test.ts`). Extract logic instead of mounting components; do not add Testing Library unless asked.
- Inside this package, `bun run lint` runs `biome check .`. For a change, prefer `bunx biome check --write <changed paths>` from the root so untouched files are not reformatted.
- Test files are excluded from the app tsconfig, but `bun run typecheck` still checks all source.
