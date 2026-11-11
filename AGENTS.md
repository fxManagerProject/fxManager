# AGENTS.md

Guidance for coding agents and the developers directing them. Read this file first, then the `AGENTS.md` beside the package you are changing. `CONTRIBUTING.md` covers community expectations; this file covers how work gets done.

## What this repository is

fxManager is a self-contained, cross-platform admin panel for FiveM & RedM servers. One Bun process supervises FXServer and serves a React panel; a companion game resource bridges the server to the panel. It is pre-`v1.0.0`: favour small, correct, reversible changes over broad rewrites, and leave unrelated code alone.

| Path | Role | Guide |
|---|---|---|
| `apps/core` | Fastify webserver, FXServer process supervision, auth, websockets, `/api` + `/internal` routes | `apps/core/AGENTS.md` |
| `apps/webpanel` | React 19 SPA served by core in production | `apps/webpanel/AGENTS.md` |
| `apps/resource` | FiveM resource (client/server) and NUI | `apps/resource/AGENTS.md` |
| `packages/database` | Drizzle schema, repositories, migrations | `packages/database/AGENTS.md` |
| `packages/shared` | Types, constants and pure utilities shared by every app | `packages/shared/AGENTS.md` |
| `packages/ui` | ShadCN-based React primitives | `packages/ui/AGENTS.md` |
| `scripts` | Build, test, migrate, version-bump and release tooling | — |
| `agent-changes` | One agent record per change, named by branch and date | `agent-changes/README.md` |

## Toolchain

- Bun `1.3.2` (`packageManager`) runs everything: install, scripts, tests, bundling. Use `bun`; keep `bun.lock` the only lockfile.
- Turbo orchestrates `lint`, `format`, `typecheck` and `build`; workspace packages are `@fxmanager/*`.
- TypeScript is strict, with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` and `noImplicitOverride`.
- Biome is the only linter/formatter (no ESLint/Prettier). The root `biome.json` is authoritative.
- SQLite through Drizzle; there is no external database.

## Commands

Run from the repository root unless stated otherwise.

| Command | Purpose |
|---|---|
| `bun install` | Install workspace dependencies |
| `bun dev` | Turbo dev: core, webpanel and resource watchers |
| `bunx biome check --write <paths>` | Biome check + safe fixes for the changed source files |
| `bun run lint` / `bun run format` | Repo-wide lint / format (see below) |
| `bun run typecheck` | `tsc --noEmit` in every package |
| `bun test` | Run every `*.test.ts` through `scripts/test.ts` |
| `bun test <path>` | Run one test file directly |
| `bun run build --target=windows\|linux` | Production build into `dist/` |
| `bun db:migrate` | Generate a migration and register it (interactive) |
| `bun db:studio` | Browse the local SQLite database |

A repo-wide Biome run currently fails on pre-existing diagnostics and formatting drift in root config files, and `bun run lint` inherits that. Scope checks to the files you changed; never mass-format unrelated files to make a repo-wide run green.

Development ports: the webpanel Vite server runs on `:5173` and proxies `/api` and `/api/ws` to `:3000`, so keep `PANEL_PORT=3000` locally (it is the fallback when unset). The resource NUI dev server is on `:5175`. Production serves the panel on `PANEL_PORT` (`4000` in `.env.example`).

The root `.env` is read in development by `apps/core/src/common/env.ts`; `.env.example` lists the supported variables. Never commit `.env` or its values.

## Conventions

- **Formatting**: tabs, single quotes, semicolons, trailing commas, always-parenthesised arrows, LF line endings, ~100 columns. Let Biome decide; do not hand-format around it.
- **Imports**: workspace packages via `@fxmanager/*`; webpanel internals via `@/`; relative imports within a package. `packages/shared` has no root export — import `@fxmanager/shared/types`, `@fxmanager/shared/constants` or `@fxmanager/shared/utils`.
- **Comments**: explain why, not what. Longer files use `// region <name>` section markers. Suppress a lint rule only with a reason on the same line (`// biome-ignore lint/<group>/<rule>: reason`), never as a blanket file-level escape for new code.
- **Ownership**: server logic in `apps/core`, browser logic in `apps/webpanel`, game-runtime logic in `apps/resource`, persistence in `packages/database`, contracts in `packages/shared`, primitives in `packages/ui`. Apps integrate through HTTP boundaries or shared packages; importing app code from another app is a bug.
- **Persistence**: use `repo` from `@fxmanager/database`. Apps never open SQLite or write SQL directly.
- **State**: runtime state lives in module managers (`manager.ts`) with explicit start/stop methods; timers must be `unref()`-able and injectable for tests.
- **Failures**: return explicit errors — `{ error: string }` with a status code from API routes, short codes such as `not_found` thrown from repositories. Never swallow exceptions. Log with the existing `[area]` prefix.
- **Security**: authorise on the server (`sessionAuth` + `PermissionManager`); `/internal/*` is resource-token only. Never log, return or commit tokens, cookies, secrets or `.env` values. Validate user-supplied resource names, player ids and paths with the existing helpers, and keep configured paths inside their roots.
- **Generated output**: `dist/`, `data/*.db*`, `.turbo/` and `node_modules/` are not edited by hand. `bun.lock` changes only with dependency changes.
- **Versions**: never bump versions in `package.json` or `fxmanifest.lua` by hand; `scripts/release.ts` updates every workspace package.

## Testing

- Tests are `*.test.ts` files colocated with the code they cover and use `bun:test` (`describe`, `it`, `expect`, `spyOn`).
- New logic and bug fixes ship with a test that fails without the change. Where a test is impractical (React trees, FXServer process control), say so under `Known gaps` in the change record instead of skipping silently.
- Keep tests deterministic: inject clocks and intervals (`tick(now)`, `{ tickMs }`) rather than sleeping, use in-memory SQLite for repositories, and stub FiveM globals before dynamic import.
- The webpanel has no DOM test harness. Extract pure helpers and test those; do not add a testing library unless asked.

## Git, commits and PRs

- Agents do not create branches, commit, push, tag, open PRs or run the release script unless the developer asks. When asked, use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:` …), which release-drafter maps into release categories.
- Keep one concern per commit. Do not mix formatting sweeps with behaviour changes.
- PRs fill `.github/PULL_REQUEST_TEMPLATE.md`: purpose and linked issue, tests ticked, and the Generative AI disclosure answered. Reference the change-record entry described below.
- Update the relevant README or docs when commands, endpoints, environment variables or behaviour change.

## Agent change record (required)

Every change that involved a coding agent adds one record to `agent-changes/`, named after the branch and date: `agent-changes/<branch>-YYYY-MM-DD.md`, with `/` in the branch name replaced by `-`. It is how a reviewer sees which agent produced the code, what was touched, what was verified, and whether the developer actually read it. Entries accumulate as history and are never deleted. It complements — never replaces — the Generative AI disclosure in the PR template.

1. **Finish the code first.** Run `bunx biome check --write <changed source files>` and the tests covering the change (`bun test <test files>`); a documentation-only change has neither, so record that under `Checks`. CI also runs `bun run typecheck` and both platform builds, so run those too when you touched types, entrypoints, dependencies or build configuration.
2. **Add the record** by copying `agent-changes/TEMPLATE.md` to `agent-changes/<branch>-YYYY-MM-DD.md`. If that file already exists for another change on the same branch and day, append a counter (`...-2.md`). Report the tool and model truthfully, the files actually changed, the checks actually run, and anything you did not read or verify under `Known gaps`. Never record a check you did not run.
3. **Do not sign for the developer.** Leave `Developer review` as `pending` until the developer confirms they read the diff. Fill in their handle and date only when they explicitly say they reviewed it.
4. **The developer completes the sign-off** after reading the diff. The minimum read is every added or changed line in the change's diff; anything read less thoroughly is listed explicitly in that field. Reviewers treat `pending` or a partial list as unverified work.
5. **Reference the record** in the PR description, or in the commit message when working directly on `main`, so reviewers can find it without searching.

Rules:

- One record per change, created from the template. New files only: never rewrite or delete an existing entry.
- The record must match the final diff. If the change grows, update the same file before it is merged.
- `.github/workflows/agent-records.yml` validates required fields and the `<branch>-YYYY-MM-DD` filename on PRs and pushes to `main`.
- Changes with no modified files (questions, reviews, investigations) need no record.
- No secrets, tokens, personal data or `.env` contents in a record; the agent name, model and developer handle are enough.

## Definition of done

- The change lives in the right package and respects app boundaries.
- `bunx biome check --write` reports no diagnostics in the files you changed, and the affected tests pass; typecheck or build problems introduced by the change are resolved.
- New behaviour is covered by a colocated test, or the gap is stated in the change record.
- Docs or READMEs are updated where behaviour, commands, endpoints or environment variables changed.
- `agent-changes/<branch>-YYYY-MM-DD.md` exists for the change, is named correctly, and carries the developer sign-off (complete, or explicitly `pending` while review is outstanding).
- No debug leftovers, secrets, generated output or unrelated formatting in the diff.
