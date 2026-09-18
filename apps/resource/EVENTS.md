# Event Naming Convention

All custom events in this resource follow a single naming scheme, derived from the
callback transport in `src/client/utils/callbacks.ts` and `src/server/utils/callbacks.ts`.

## Format

```
fxmanager:<direction>:<domain>:<action>
```

Four segments, all lowercase, hyphenated (`kebab-case`) when a segment needs multiple words.

| Segment   | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `fxmanager` | Resource namespace. Always literal — never derived from runtime values. |
| `direction` | Which sides the event travels between (see table below).               |
| `domain`    | Feature subsystem the event belongs to: `player`, `ui`, `monitoring`, … |
| `action`    | What the event does (see [Action naming](#action-naming)).              |

## Direction reference

| Flow               | Prefix             | Transport                                                             |
| ------------------ | ------------------ | --------------------------------------------------------------------- |
| Client → Server    | `fxmanager:c2s:…`  | Networked — treat payload as **untrusted input**                      |
| Server → Client    | `fxmanager:s2c:…`  | Networked — targeted (`src`) or broadcast (`-1`)                      |
| Server → Server    | `fxmanager:s2s:…`  | Local to the server side — **never** networked                        |
| Client → Client    | `fxmanager:c2c:…`  | Local to the client side — **never** networked                        |

The direction segment is documentation that the type system can't give you: it tells the
reader immediately whether an event crosses the network (and therefore needs validation
and permission checks on the receiving side).

## Callback transport (existing, unchanged)

The bidirectional callback system owns its own namespace and is the **only** sanctioned
way to do request/response:

- `fxmanager:cb:c2s:req` / `fxmanager:cb:c2s:res` — client invokes a server callback
- `fxmanager:cb:s2c:req` / `fxmanager:cb:s2c:res` — server invokes a client callback

Note: for callbacks, the direction segment names the side that *initiates* the exchange —
the `req` and `res` events themselves travel in opposite directions. This matches the
existing `EVENT_NAMES` constants and must not be changed unilaterally.

Do not hand-roll `:req`/`:res` event pairs for new request/response flows. Register a
callback with `ServerCallbacks.register` / `ClientCallbacks.register` (which gives you
timeouts, fallbacks and permission enforcement for free) and trigger it with
`ServerCallbacks.trigger` / `ClientCallbacks.trigger`. Raw events under the prefixes
above are fire-and-forget commands or notifications only.

## Action naming

- **Commands** (the receiver is expected to *do* something): present-tense verb.
  `save`, `fetch`, `kick`, `teleport-to-waypoint`
- **Notifications** (the receiver is *told* that something happened): past tense.
  `updated`, `dropped`, `spawned`, `settings-changed`

## Examples

| Event name                                | Flow            | Meaning                                         |
| ----------------------------------------- | --------------- | ----------------------------------------------- |
| `fxmanager:c2s:monitoring:report-fps`     | Client → Server | Client reports its FPS to the server            |
| `fxmanager:s2c:ui:show-notification`      | Server → Client | Server tells a client's UI to show a message    |
| `fxmanager:s2c:player:updated`            | Server → Client | Broadcast that a player's state changed         |
| `fxmanager:s2s:monitoring:player-dropped` | Server → Server | Internal server notice that a player dropped    |
| `fxmanager:c2c:session:started`           | Client → Client | Client-side notice that the local session began |

## Rules

1. **Declare every event name as a constant** in `EVENT_NAMES`
   (`src/common/types/callbacks.ts`) — never inline string literals at emit/listen sites.
2. **No dynamic event names.** Never concatenate or template event names; if the target
   or subject varies, encode it in the payload instead.
3. **No identifiers in names.** Player ids, entity handles, etc. go in the payload, never
   in the event name.
4. **Validate `c2s` payloads.** Every client → server event is untrusted input: validate
   shape and check permissions server-side, mirroring how `ServerCallbackManager`
   gates handlers with `requiredPermission` / `hasPermission`.
5. **Match transport to prefix.** `c2c` and `s2s` events must not be registered with
   `onNet` or emitted with `emitNet`; `c2s`/`s2c` events must not be handled with plain
   `on` on the receiving side.
6. **NUI callbacks** (`RegisterNUICallback`) use a bare `action`-style name in
   `kebab-case` (e.g. `close`, `fetch-config`) since they are namespaced by the browser
   bridge, not by the event system.
7. **Upstream events are exempt.** Native or third-party events (`playerConnecting`,
   `onResourceStart`, `chat:addMessage`, …) keep their upstream names — this convention
   applies only to events this resource defines itself.
