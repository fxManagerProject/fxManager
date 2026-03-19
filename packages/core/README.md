# Core

Core handler of fxManager. Responsible for spawning the `fxserver` process, buffering console output, and maintaining game state (e.g., player lists).

## Entry Point
`src/index.ts` — Orchestrates service initialization and starts the API.

## Structure

| Directory           | Purpose                                            | Technologies          |
| --------------------| -------------------------------------------------- | --------------------- |
| `common/`           | Shared utilities, types, and constants             | TypeScript            |
| `config/`           | Environment variable parsing and global config     | TypeScript            |
| `services/game/`    | State management (player counts, server status)    | `@fxmanager/database` |
| `services/process/` | OS process handling (spawn, stdio piping, signals) | Bun.spawn             |
| `webserver/`        | Internal webserver for Game API & Panel API        | ElysiaJS              |
