# Code logic

Module-by-module responsibilities and the non-obvious decisions behind them. One short entry
per module; record the *why*, not a line-by-line narration. Keep this in sync as modules land
(the `doc-sync` skill maps source changes here).

## Wire contract - `packages/protocol`

*(M0)* Single source of truth for the message envelope, message types, the `Command` union, and
`Capabilities`. **Zod-first:** Zod 4 schemas are authored once; TS types come from `z.infer` and
the JSON Schema (`schema/protocol.schema.json`) from `z.toJSONSchema()` (`pnpm -F @slate/protocol
gen:schema`). Consumed as raw TS source via `workspace:*` by both the app (Metro) and the helper
(tsx) - no build step. The Swift helper mirrors these types manually (diff on every protocol change).
`Command` ships the v1 kinds only; v2 kinds (`keystroke`/`space`/`app_switch`/`media`/`macro`) are added later.

## Transport - `apps/mobile/src/lib/ws`

*(M1)* `Transport` interface with a `WebSocketTransport` implementation. The app builds a
semantic `Command` and hands it to the transport; it never calls OS-specific logic directly.
This is what keeps the backend pluggable (a future `SshTransport` implements the same interface).
Socket is a module-level singleton with manual lifecycle + reconnect/backoff. A JSON-level
heartbeat (`ping`/`pong`) detects stale connections - RN's WebSocket cannot send protocol pings.

## Helper - `helpers/node-helper`

*(M0)* The Node MVP backend, run with `tsx` (Node 24's native TS stripping can't load workspace
`.ts` from `node_modules`). M0 is a smoke server: a `ws` `WebSocketServer` that imports
`@slate/protocol` and logs on listen/connection. *(M1)* adds `bonjour-service` advertising of
`_slate._tcp`, LAN-only binding, and `hello` / `command.execute` handling.

## Pairing & auth

*(M2)* 6-digit code (or QR) -> helper issues a long-lived token -> `auth{token}` on every
reconnect. No command runs before `auth_ok`. Token lives in `expo-secure-store`, never MMKV.

## Icon cache

*(M2)* Real macOS icons fetched lazily (only on app-picker open / button assignment), cached in
MMKV keyed by `bundleId` + `iconVersion` (the app bundle's mtime). One icon per WS message to
avoid Android large-frame OOM.

<!-- Add a section per module as it is built. Decision entries reference plan.md section 15 where relevant. -->
