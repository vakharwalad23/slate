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

One curried Zustand root store composed of five slices, all wrapped in `devtools(persist(...))`.
`connection.slice.ts` owns WebSocket lifecycle and is the message hub: inbound `hello_ack`,
`pair_*`, `auth_*`, and `apps.*` frames are forwarded to the relevant slices; `sendCommand` is
gated on `authPhase === 'paired'`. `pairing.slice.ts` runs an 8-phase `AuthPhase` state machine
(idle / authenticating / needs_pairing / code_entry / confirming / paired / auth_error /
pair_error). `deck.slice.ts` holds the Zod-validated deck model (CRUD, persisted, validated on
rehydration via `merge`). `apps.slice.ts` drives `apps.list` and `apps.icon` requests and holds
the icon cache keyed by `bundleId + iconVersion`. `discovery.slice.ts` controls zeroconf browsing
(gated - browse only when the user opens discovery UI). The import edge is always store ->
transport, never reversed.

## Helper - `helpers/node-helper`

The Node dev/CI backend, run with `tsx` (Node 24's native TS stripping can't load workspace `.ts`
from `node_modules`). A `ws` `WebSocketServer` validates each frame with `MessageSchema.safeParse`,
then `dispatch.ts` answers `hello` (-> `hello_ack` with capabilities), `command.execute` (-> runs
the command, then `command.result`), and `ping` (-> `pong`). `commands.ts` executes a `Command`
through an injectable runner (`launch_app` shells out to `open -a`); injecting the runner keeps it
unit-testable. It advertises `_slate._tcp` over `bonjour-service` and binds all interfaces. The
production macOS backend is the Swift helper (see below).

## Helper - `helpers/mac-helper` (Swift, primary macOS backend)

`MenuBarExtra` SwiftUI app targeting macOS 14+, Swift 6.2 strict concurrency, non-sandboxed.
Generated from `project.yml` via xcodegen; `.xcodeproj` is gitignored.

**Protocol/** - `Protocol.swift` hand-mirrors `@slate/protocol` as Swift `Codable` structs
(envelope + two-pass `type` decode, `Command` keyed by `kind`, `Capabilities`). Reply ids are
lowercased UUIDs. `MessageCoding.swift` encodes/decodes the envelope. Kept in sync with the TS
package manually; diff on every protocol change.

**Server/** - `WebSocketServer` uses `NWListener` in WebSocket server role, binding all interfaces.
`Connection` (class, serialized receive loop) handles one peer. `ConnectionRegistry` (actor) enforces
a SINGLE active connection - a new connection replaces and closes the prior one.

**Dispatch/** - `ClientSession` (actor) owns per-connection auth state and routes inbound messages:
`hello` -> `hello_ack`, `ping` -> `pong`, `pair_request`/`pair_confirm` -> `PairingService`,
`auth` -> `TokenStore`, `command.execute`/`apps.list`/`apps.icon` gated via `AuthGate` (blocked
pre-auth; `ping` is allowed before auth).

**Discovery/** - `BonjourAdvertiser` calls the dns-sd C API (`DNSServiceRegister`) directly to
advertise `_slate._tcp`. `NWListener.Service` is avoided due to FB14321888.

**Commands/** - `CommandExecutor` maps `Command` kinds to macOS actions: `launch_app` via
`open -a` then `-b` fallback; `activate_app` via `NSRunningApplication` + frontmost-verify + retry
loop (works around the macOS 26 Tahoe focus quirk); `run_shortcut`; `run_applescript`.
`ProcessRunner` is injectable for unit tests. `AppActivator.swift` isolates the Tahoe-specific
retry logic.

**Auth/** - `PairingService` (actor) generates a 6-digit code (TTL <=120 s), rate-limits after ~5
failed attempts. `TokenStore` (actor) stores a 32-byte token as 0600 JSON in Application Support;
supports revoke per device. `AuthGate` checks the per-session authed flag before routing commands.

**Apps/** - `AppEnumerator` scans `/Applications` and standard app directories. `AppCatalog` (actor)
caches the enumeration result.

**Icons/** - `IconRenderer` fetches the icon via `NSWorkspace.icon(forFile:)`, scales to 256 px,
and encodes as base64 PNG. One icon per WS message to avoid large-frame OOM on Android.

**Permissions/** - `PermissionProbe` calls `AXIsProcessTrustedWithOptions` to check Accessibility
grant; result surfaced in the menu UI.

**Menu UI** - `MenuContent.swift` (`.window` style `MenuBarExtra`): shows server status,
`host:port`, current pairing code, paired devices with per-device revoke, and Accessibility state.

**Distribution** - `scripts/make-dmg.sh` builds a self-signed drag-and-drop DMG (no notarization);
users clear quarantine with `xattr -dr com.apple.quarantine`.

## Pairing & auth

`pair_request` -> helper shows 6-digit code (TTL <=120 s, rate-limited) -> app sends
`pair_confirm { code }` -> helper replies `pair_ok { token }`. On every subsequent reconnect the
app sends `auth { token }` -> `auth_ok` before any command. No `command.execute`, `apps.list`, or
`apps.icon` is processed before `auth_ok` (`AuthGate` on the Swift side, `authPhase === 'paired'`
gate in `connection.slice.ts` on the mobile side). Token stored in `expo-secure-store`
(`lib/secure/token-store.ts`) with a stable `deviceId`; in-memory cache avoids repeated keychain
reads. Per-device revoke supported on the helper via `TokenStore`.

## Icon cache

`apps.slice.ts` requests icons lazily (on app-picker open or button assignment) via `apps.icon`.
`IconRenderer` (Swift) replies one icon per WS message (avoids Android large-frame OOM). The mobile
side caches in the `slate-icons` MMKV namespace keyed by `bundleId + iconVersion`
(`lib/icons/icon-cache.ts`); `hooks/useAppIcon.ts` serves from cache or fires a request.
`iconVersion` is the app bundle mtime so stale icons are automatically evicted on app update.
