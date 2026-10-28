# fxManager in-game resource

F6 opens the quick menu. F7 opens the panel. Staff sections follow the configured ACE permissions.

## Reports

The Reports page is a UI scaffold. Backend integration is deferred while its design is under discussion; submitting reports and replies is unavailable in this branch.

## Player monitoring

**F6 → Player tags / Player blips** exposes tags and blips. Monitoring requires `fxmanager.game.players`.

Tags appear above other streamed players within 150 metres, not your own character. They show a server ID, name, armour value, health bar, and speaking indicator. Blips distinguish on-foot, vehicle, and dead players in your routing bucket.


Displayed health subtracts GTA’s 100-point offset and clamps at zero (200 → 100, 150 → 50). The player roster includes health, armour, vehicle state, ping, and routing bucket. The Players page defaults to Online. All players includes online players and up to 50 recent database matches by name or identifier, with online/offline status and last-seen times for offline players. Offline players can be warned or banned; kicks require an online player. Moderation actions still require their individual kick, ban, or warn permissions.

## Development

From the repository root:

```powershell
bun install
bun run --cwd apps/resource build
bun run --cwd apps/resource web:dev
```

The resource build uses the installed `@overextended/fx-utils`. The core supplies the resource API token and API port. Restart through the manager so those runtime settings are restored correctly.
