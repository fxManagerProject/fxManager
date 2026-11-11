# packages/shared

Runtime-agnostic contracts and helpers used by core, the webpanel and the resource. No Node/Bun/FiveM or React APIs here — the package must bundle for the server, the browser and the game runtime.

- Import through subpaths only: `@fxmanager/shared/types`, `@fxmanager/shared/constants` and `@fxmanager/shared/utils`. There is no package-root export; add new modules to the matching `index.ts` barrel.
- `types/` is the cross-app contract: API DTOs, websocket messages, process, session, perf and config shapes. Change a type together with its producer and consumers; prefer discriminated unions and literal types over loose objects; no `any`.
- `constants/` holds shared enums, bitflags and setting keys (`permissions.ts`, `settings.ts`, `events.ts`, `audit.ts`). Permission arithmetic lives in `utils/permissions.ts` (`PermissionManager.effective/has/isMaster`); never re-implement bit checks.
- `utils/` holds pure functions (group slugs, resource-name validation, startup arguments, settings access). Keep them side-effect free and predictable; invalid input returns a value unless the existing helper deliberately throws.
- Tests are colocated `*.test.ts` files using `bun:test`; cover edge cases as well as the happy path.
- `bun run lint`, `bun run format` and `bun run typecheck` are the package checks; for a change, run `bunx biome check --write <changed paths>` from the root.
