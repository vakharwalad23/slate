# Code logic

Module-by-module responsibilities and the non-obvious decisions behind them. One short entry
per module; record the *why*, not a line-by-line narration. Keep this in sync as modules land
(the `doc-sync` skill maps source changes here).

## Wire contract - `packages/protocol`

Single source of truth for the message envelope, message types, the `Command` union, and
`Capabilities`. **Zod-first:** Zod 4 schemas are authored once; TS types come from `z.infer` and
the JSON Schema (`schema/protocol.schema.json`) from `z.toJSONSchema()` (`pnpm -F @slate/protocol
gen:schema`). Consumed as raw TS source via `workspace:*` by both the app (Metro) and the helper
(tsx) - no build step. The Swift helper mirrors these types manually (diff on every protocol change).
`Command` ships the v1 kinds only; v2 kinds (`keystroke`/`space`/`app_switch`/`media`/`macro`) are
added later. `MessageOf<'type'>` narrows the union so both sides build outbound messages as typed
literals without a cast.

## Transport - `apps/mobile/src/lib/ws`

`Transport` interface with a `WebSocketTransport` implementation. The app builds a semantic
`Command` and hands it to the transport; it never calls OS-specific logic directly. This keeps the
backend pluggable (a future `SshTransport` implements the same interface). The socket is a
module-level singleton: a monotonic `generation` counter plus a `desired` flag invalidate stale
callbacks so rapid connect/disconnect can never leave two live sockets or duplicate timers, and the
four handlers are detached before `close()` because RN fires `onclose` asynchronously. A JSON-level
`ping`/`pong` heartbeat detects stale connections (RN's WebSocket cannot send protocol pings); a
missed-pong window routes through one reconnect path with exponential backoff, and a NetInfo
subscription reconnects immediately when connectivity returns. Inbound frames are validated with
`MessageSchema.safeParse` and dropped on failure. `messages.ts` builds outbound `hello` / `ping` /
`command.execute` (uuids from `expo-crypto`).

## App state - `apps/mobile/src/stores`

One curried Zustand root store; the `connection` slice owns connection status, the handshake result
(`helper` info + capabilities), and the last command result, and exposes `connect` / `disconnect` /
`sendCommand`. It registers the transport handlers once at creation - the import edge is store ->
transport only (no cycle); the transport never imports the store. The home screen
(`src/app/index.tsx`) reads it via atomic selectors and drives manual host:port connect plus the
first button (`launch_app`).

## Helper - `helpers/node-helper`

The Node MVP backend, run with `tsx` (Node 24's native TS stripping can't load workspace `.ts` from
`node_modules`). A `ws` `WebSocketServer` validates each frame with `MessageSchema.safeParse`, then
`dispatch.ts` answers `hello` (-> `hello_ack` with capabilities), `command.execute` (-> runs the
command, then `command.result`), and `ping` (-> `pong`). `commands.ts` executes a `Command` through
an injectable runner (`launch_app` shells out to `open -a`); injecting the runner keeps it
unit-testable. It advertises `_slate._tcp` over `bonjour-service` and binds all interfaces for now
(a later change narrows this to the chosen LAN address).

## Pairing & auth

6-digit code (or QR) -> helper issues a long-lived token -> `auth{token}` on every reconnect. No
command runs before `auth_ok`. Token lives in `expo-secure-store`, never MMKV. (Not built yet.)

## Icon cache

Real macOS icons fetched lazily (only on app-picker open / button assignment), cached in MMKV keyed
by `bundleId` + `iconVersion` (the app bundle's mtime). One icon per WS message to avoid Android
large-frame OOM. (Not built yet.)

<!-- Add a section per module as it is built. Decision entries reference plan.md where relevant. -->
