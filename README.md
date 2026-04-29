# fxManager

A self-contained, cross-platform admin panel for FiveM & RedM servers.  
Single binary deployment - no runtime dependencies required on the target machine.

> [!WARNING]
> This project is still in intensive development, it is **not** to be considered stable until a `v1.0.0+` release.
> If this repository is public, it's for transparency, feedback and open source contributions to help it achieve this milestone.

## Structure

Each app/package will have it's own more detailled structure in it's README.

```
fxManager/
├── apps/
│   ├── core/          # Process Manager & Webserver
│   ├── resource/      # FxServer resource to connect to panel
│   └── webpanel/      # React SPA served by the webserver
├── packages/
│   ├── database/      # Drizzle schema & Migration handler
│   ├── shared/        # Enums, types, and utils
│   └── ui/            # Shared React ShadCN components
├── biome.json         # Root linting/formatting
├── package.json       # Workspace definitions
└── turbo.json         # Build pipeline config
```

---

## Development

```bash
# Install dependencies
bun install

# Start system
bun dev
```

The React dev server runs on `:5173` and proxies API/WS calls on `:3000`.

---

## Code Quality

```bash
bun check        # lint + format + fix (recommended during dev)
bun lint         # lint only
bun format       # format only
bun typecheck    # tsc --noEmit across all packages (via Turbo)
bun db:studio    # open Drizzle Studio to browse the database (optional)
bun db:migrate   # creates a new migration file
```

---

### Game Resource ( [`apps/resource`](./apps/resource) )
Commands specific to the game-side resource and NUI:

* **`bun web:dev`** – Runs the Vite dev server for the NUI frontend.
* **`bun watch`** – Rebuilds the resource automatically as you save files.
* **`bun deploy`** – Bundles the resource and copies it to the path defined in your `DEPLOY_PATH` environment variable.

---

## Database Migrations

Migrations are automated via a synchronization utility. Do not manually edit the migration registry.

### Adding a Migration

1. **Generate Migration**: Run the generation script using:
   ```bash
   bun run db:migrate
   ```
2. **Describe**: When prompted, provide a short description of the changes.

The utility will automatically:
* Sanitize and split the SQL queries.
* Create a structured `.ts` migration file in `packages/database/src/migrations/migrations/`.
* Register the new migration in `packages/database/src/migrations/index.ts`.

### Rules
* **Immutability**: Never modify a migration file (`.sql`, `.ts`, or `.json`) once it has been deployed to production.
* **Automation**: Migrations are applied automatically on the next application startup.

---

## Tooling

**Biome** handles linting and formatting (replacing ESLint and Prettier) using a single, high-performance configuration at the root.

---

## Building

```bash
# Build for both platforms
bun run build

# Build for a specific platform
bun run build --target=linux
bun run build --target=windows
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

> [!IMPORTANT]
> The `public/` folder must remain in the same directory as the binary when deploying. The server resolves it relative to its own location at runtime.

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

1. Copy `dist/resource/` into your server's `resources/` folder as `fxManager`
2. **IMPORTANT** Add `ensure fxManager` to your `server.cfg`

---

## Environment Variables

| Variable              | Default           | Description                          |
|-----------------------|-------------------|--------------------------------------|
| `FXSERVER_EXECUTABLE` | `./FXServer`      | Path to FXServer binary              |
| `FXSERVER_DATA_PATH`  | `./server-data`   | Path to server-data folder           |
| `FXSERVER_CFG`        | `server.cfg`      | Config file name inside data path    |
| `PANEL_PORT`          | `3000` (opt)      | Web panel port                       |
| `COOKIE_SECRET`       | N/A (opt)         | Defines the secret for cookie sign   |
| `DEPLOY_PATH`         | N/A               | Used in development for the resource |

## Errrh anything else ?

![dumb monke](.github/image.png)
