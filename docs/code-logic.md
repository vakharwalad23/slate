# Code logic

Module-by-module responsibilities and the non-obvious decisions behind them. One short entry
per module; record the *why*, not a line-by-line narration. Keep this in sync as modules land
(the `doc-sync` skill maps source changes here).

## Wire contract — `packages/protocol`

*(M0)* Single source of truth for the message envelope, message types, the `Command` union, and
`Capabilities`. Exported as TS types + JSON Schema; consumed by both the app and the helper so
the two never drift. The Swift helper mirrors these types manually (diff on every protocol change).

## Transport — `apps/mobile/src/lib/ws`

*(M1)* `Transport` interface with a `WebSocketTransport` implementation. The app builds a
semantic `Command` and hands it to the transport; it never calls OS-specific logic directly.
This is what keeps the backend pluggable (a future `SshTransport` implements the same interface).
Socket is a module-level singleton with manual lifecycle + reconnect/backoff. A JSON-level
heartbeat (`ping`/`pong`) detects stale connections — RN's WebSocket cannot send protocol pings.

## Pairing & auth

*(M2)* 6-digit code (or QR) → helper issues a long-lived token → `auth{token}` on every
reconnect. No command runs before `auth_ok`. Token lives in `expo-secure-store`, never MMKV.

## Icon cache

*(M2)* Real macOS icons fetched lazily (only on app-picker open / button assignment), cached in
MMKV keyed by `bundleId` + `iconVersion` (the app bundle's mtime). One icon per WS message to
avoid Android large-frame OOM.

<!-- Add a section per module as it is built. Decision entries reference plan.md §15 where relevant. -->
