# packages/database

SQLite persistence: the Drizzle schema, repositories and the versioned migration registry.

## Schema and repositories

- `src/schema.ts` is the single schema. Tables use integer timestamps (`{ mode: 'timestamp' }`), explicit indexes and unique constraints, cascade deletes, and `// region` sections grouping related tables. Relations sit next to their tables.
- `src/repositories/<name>.ts` holds one repository per domain: a class with a private constructor, `getInstance(db)`, and a `createXRepository(db)` factory. Register the factory in `repo` in `src/index.ts`.
- Apps import `repo` (and relevant types) from `@fxmanager/database`; they never construct a database or write SQL.
- Use Drizzle query builders with bound parameters. Raw SQL belongs in migrations only.
- Repositories throw short error codes (`throw new Error('not_found')`) that routes translate into responses; keep that shape rather than inventing per-repository errors.
- Package exports are the root (`repo`, `applyMigrations`), `./types` and `./schema`.

## Migrations

- Migrations are versioned TypeScript objects (`{ version, description, up: string[] }`) in `src/migrations/migrations/`, registered in `src/migrations/migrations/index.ts` and re-exported by `src/migrations/index.ts`.
- Generate them with `bun db:migrate` from the root: it runs `drizzle-kit generate`, prompts for a description, splits and sanitises the SQL, writes the file and registers it. Do not create or register migration files by hand, and do not edit the registry directly.
- Immutable once deployed: never modify a committed migration (`.sql`, `.ts` or `.json`). Fix forward with a new migration.
- The runner applies each version once inside a transaction and records it in `schema_version`. Statements must be valid against a fresh database because tests replay the full registry.
- `drizzle.config.ts` exists only for `db:studio`; runtime migrations do not use drizzle-kit.

## Connection

- `src/index.ts` opens `./data/panel.db` in production and `../../data/panel.db` in development, enables WAL, foreign keys and a busy timeout, and retries `SQLITE_BUSY` five times. Do not bypass it by opening your own connection.
- `applyMigrations()` runs at core startup.

## Tests

- Repository tests use an in-memory database: `new Database(':memory:')`, enable foreign keys, `runMigrations(testSqlite, migrations)`, wrap with `drizzle(testSqlite, { schema })`, then build the repository.
- Singletons persist between tests: reset the instance (`(instance.constructor as any).instance = undefined`) in `beforeEach`, as `repositories/settings.test.ts` does, and silence `console.log` with `spyOn`.
- Test the registry and journal planning (`migrations/*.test.ts`) when touching migration bookkeeping.
