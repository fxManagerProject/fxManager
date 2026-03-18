# fxManager

A self-contained, cross-platform admin panel for FiveM & RedM servers.  
Single binary deployment - no runtime dependencies required on the target machine.

> [!WARNING]
> This project is still in intensive development, it is **not** to be considered stable until a `v1.0.0+` release.
> If this repository is public, it's for transparency, feedback and open source contributions to help it achieve this milestone.

---

## Stack

| Layer             | Tech                            | Location            |
|-------------------|---------------------------------|---------------------|
| Runtime           | Bun (compiled into binary)      |                     |
| Monorepo          | Turbo + Bun Workspaces          |                     |
| Linting           | Biome (lint + format + imports) |                     |
| Process Manager   | Bun                             | `packages/core`     |
| Web Server        | ElysiaJS                        | `packages/panel`    |
| Frontend          | React + Vite SPA                | `packages/panel-ui` |
| Database          | SQLite + Drizzle ORM            | `packages/database` |
| FiveM/RedM Bridge | Lua resource                    | `packages/resource` |

---

## Project Structure

```
packages/
  core/       - Process manager: spawns & supervises FiveM/RedM
  panel/      - ElysiaJS API
  panel-ui/   - React SPA
  database/   - Drizzle schema, migrations, repositories
  resource/   - Drop-in FiveM/RedM Lua resource
shared/
  types/      - Shared TypeScript types
  utils/      - Shared helper functions
```

---

## Development

```bash
# Install dependencies
bun install

# Start everything
bun dev
```

Or run packages individually:

```bash
bun dev:core    # process manager only
bun dev:panel   # panel server + vite client
```

The React dev server runs on `:5173` and proxies API/WS calls to Elysia on `:4000`.

---

## Code Quality

```bash
bun check        # lint + format + fix (recommended during dev)
bun lint         # lint only
bun format       # format only
bun typecheck    # tsc --noEmit across all packages (via Turbo)
bun db:studio    # open Drizzle Studio to browse the database (optional)
```

### Adding a migration

Edit `packages/database/src/migrations/index.ts` and append to the array:

```ts
{
  version: 2,
  description: 'Add player notes',
  up: [
    'ALTER TABLE players ADD COLUMN notes TEXT',
  ],
},
```

Migrations run automatically on next startup. No CLI commands needed.

Biome handles everything ESLint + Prettier would - faster, single config at the root.

---

## Building

```bash
# Build for both platforms
bun run build.ts

# Build for a specific platform
bun run build.ts --target=linux
bun run build.ts --target=windows
```

Turbo caches build outputs - subsequent builds only rebuild what changed.

Output in `dist/`:

```
dist/
  fxmanager-linux          ← Linux binary
  fxmanager-windows.exe    ← Windows binary
  public/                  ← UI assets - must stay next to the binary
  resource/                ← Drop into your server's resources/ folder
```

> ⚠️ The `public/` folder must remain in the same directory as the binary when deploying. The server resolves it relative to its own location at runtime.

---

## Deployment

### 1. Run the binary

```
your-deploy-folder/
  fxmanager-linux      (or fxmanager-windows.exe)
  public/
  .env
```

```bash
./fxmanager-linux    # or fxmanager-windows.exe
```

The panel will be available at `http://your-server-ip:4000`.

### 2. Install the resource

1. Copy `dist/resource/` into your server's `resources/` folder as `fxmanager`
2. Edit `resources/fxmanager/config.lua`:
   - Set `Config.PanelUrl` to your panel address
   - Set `Config.ApiToken` to a token generated from the panel Settings page
3. Add `ensure fxmanager` to your `server.cfg`

---

## Environment Variables

| Variable           | Default           | Description                       |
|--------------------|-------------------|-----------------------------------|
| `PANEL_PORT`       | `4000`            | Web panel port                    |
| `FXSERVER_EXECUTABLE` | `./FXServer`      | Path to FXServer binary           |
| `FXSERVER_DATA_PATH`  | `./server-data`   | Path to server-data folder        |
| `FXSERVER_CFG`        | `server.cfg`      | Config file name inside data path |
