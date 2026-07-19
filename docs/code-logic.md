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
`CommandSchema` is a discriminated union on `kind`; `BaseCommandSchema` excludes `macro` so macro
steps cannot nest another macro (avoids a recursive type). `MessageOf<'type'>` narrows the union
so both sides build outbound messages as typed literals without a cast.

## Transport - `apps/mobile/src/lib/ws`

`Transport` interface with a `WebSocketTransport` implementation. The app builds a semantic
`Command` and hands it to the transport; it never calls OS-specific logic directly. This keeps the
backend pluggable behind a single interface. The socket is a
module-level singleton: a monotonic `generation` counter plus a `desired` flag invalidate stale
callbacks so rapid connect/disconnect can never leave two live sockets or duplicate timers, and the
four handlers are detached before `close()` because RN fires `onclose` asynchronously. A JSON-level
`ping`/`pong` heartbeat detects stale connections (RN's WebSocket cannot send protocol pings); a
missed-pong window routes through one reconnect path with exponential backoff, and a NetInfo
subscription reconnects immediately when connectivity returns. Inbound frames are validated with
`MessageSchema.safeParse` and dropped on failure. `messages.ts` builds outbound `hello` / `ping` /
`command.execute` (uuids from `expo-crypto`).

`connect()` accepts an optional `helperName` (the Bonjour service name). After repeated direct
reconnect misses, `lib/discovery/rediscovery.ts` browses for that service name and follows it to
a new IP (network-change auto re-sync). Exactly one socket and one browse are kept live at any
time; generation/desired invariants guard against races during the switchover.

**Security (app-layer E2E over ws://):** the transport stays `ws://`, but after a code-authenticated
X25519 handshake all traffic is sealed inside `enc` frames (ChaCha20-Poly1305). WSS/TLS is not used
(RN's WebSocket exposes no TLS-trust hooks); the channel encryption plus the pinned helper identity
are the security boundary, so slate is safe on untrusted LANs. Full spec: `docs/security.md`.

## App state - `apps/mobile/src/stores`

One curried Zustand root store composed of six slices, all wrapped in `devtools(persist(...))`.
`connection.slice.ts` owns WebSocket lifecycle and is the message hub: inbound `hello_ack`,
`pair_*`, `auth_*`, `apps.*`, and `state.update` frames are forwarded to the relevant slices;
`sendCommand` is gated on `authPhase === 'paired'`. `subscribeLiveState()` sends `subscribe.state`
for the `foregroundApp` topic only when the helper advertises the `liveState` capability;
`setForegroundApp(bundleId)` stores the current Mac foreground app and auto-activates the first
deck whose `autoProfile.matchBundleId` matches. The slice also stores and persists the `helperName`
(Bonjour service name) set when connecting via discovery, and passes it to `connect()` to enable
network-change rediscovery. `pairing.slice.ts` runs an 8-phase `AuthPhase` state machine
(idle / authenticating / needs_pairing / code_entry / confirming / paired / auth_error /
pair_error); calls `subscribeLiveState()` when a pairing (`onSecure`) or a reconnect (`auth_ok`)
completes. `deck.slice.ts` holds
the Zod-validated deck model (CRUD, persisted, validated on rehydration via `merge`); actions:
`addDeck` / `renameDeck` / `setDeckAutoProfile` / `deleteDeck` (last deck protected) /
`addPage` / `deletePage` (last page protected) / `reorderPage` / `reorderButton`. `DeckSchema`
carries an optional `autoProfile.matchBundleId` for live-state deck auto-switching.
`GestureMapSchema` adds `longPress`, `doubleTap`, `swipeUp/Down/Left/Right` as optional `Command`
fields per button. `apps.slice.ts` drives `apps.list` and `apps.icon` requests and holds
the icon cache keyed by `bundleId + iconVersion`. `discovery.slice.ts` (gated to the discovery UI)
runs an mDNS browse (`zeroconf.ts`, instant where the native module works) alongside a `/24` subnet
WS-handshake scan (`subnet-scan.ts`, the reliable path since react-native-zeroconf is unavailable on
the New Arch Android build); results dedupe by host. `logs.slice.ts` is a bounded ring buffer
of errors/warnings (command failures, auth errors, pair errors, discovery failures); shown in
`app/logs.tsx`, linked from the connect screen. The import edge is always store -> transport,
never reversed.

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

**Dispatch/** - `ClientSession` (actor) owns per-connection phase (plaintext / pairing / secure) and
routes inbound messages: `hello` -> `hello_ack`, `pair_request` -> `PairingService`, the `sec_*`
handshake -> `Crypto/*`, and once secure, `enc` frames are opened and the inner `auth` / `command.execute`
/ `apps.*` are dispatched (auth-gated via `requireAuth`) and replies re-sealed. `ping` is allowed
before the handshake; after it, any non-`enc` frame closes the socket.

**Discovery/** - `BonjourAdvertiser` calls the dns-sd C API (`DNSServiceRegister`) directly to
advertise `_slate._tcp`. `NWListener.Service` is avoided due to FB14321888.

**Commands/** - `CommandExecutor` maps `Command` kinds to macOS actions: `launch_app` via
`open -a` then `-b` fallback; `activate_app` via `NSRunningApplication` + frontmost-verify + retry
loop (works around the macOS 26 Tahoe focus quirk); `quit_app` (idempotent `terminate`);
`run_shortcut` (optional input piped to `shortcuts run` stdin); `run_applescript` via `osascript -e`;
`run_shell` (off by default, gated live by `Settings.allowShell`); `media` - volume via osascript,
`playpause`/`next`/`prev` via `NSSystemDefined` HID events (Accessibility-gated); `keystroke` -
`CGEvent` + `KeyTokens` token-to-ANSI map; arrow keys carry `maskSecondaryFn + maskNumericPad` so
WindowServer space shortcuts fire (Accessibility-gated); `space` - Ctrl+arrow via the `keystroke`
path (Accessibility-gated); `app_switch` - enumerate `.regular`-policy apps sorted by bundleId,
activate the neighbour of the frontmost - deterministic, avoids Cmd+Tab timing flakiness
(Accessibility-gated); `macro` - sequential steps, per-step `delayMs`, stops on first failure.
All Accessibility-gated kinds return `PermissionProbe.notGrantedMessage` when not trusted.
`ProcessRunner` is injectable for unit tests. `AppActivator.swift` isolates the Tahoe-specific
retry logic.

**Auth/** - `PairingService` (actor) generates a high-entropy pairing secret (120-bit, TTL <=120 s);
the crypto checks it (a wrong code fails to decrypt), and `recordFailure`/`recordSuccess` drive the
lockout. Lockout is actor-level: `totalFailures` + exponential `lockedUntil` cannot be reset by
opening a new connection. An unexpired secret is reused on repeat `pair_request` rather than rerolled.
`scripts/brute-force-pairing.test.mjs` drives the real handshake with wrong secrets to validate it.
`TokenStore` (actor) stores a 32-byte token as 0600 JSON in Application Support; per-device revoke
calls `ConnectionRegistry.closeIfDevice` to force-drop the live socket immediately.

**Crypto/** - `IdentityKeyStore` (0600 `identity.json`) holds the helper's static Curve25519 key;
`Handshake` runs the pair (NX+psk) and reconnect (NK) responder; `RecordLayer` seals/opens `enc`
frames. Mirrors `packages/protocol/src/crypto/*`, pinned by `crypto-vectors.json`. See
[`security.md`](security.md).

**Apps/** - `AppEnumerator` scans `/Applications` and standard app directories. `AppCatalog` (actor)
caches the enumeration result.

**Icons/** - `IconRenderer` fetches the icon via `NSWorkspace.icon(forFile:)`, scales to 256 px,
and encodes as base64 PNG. One icon per WS message to avoid large-frame OOM on Android.

**Permissions/** - `PermissionProbe` reads Accessibility trust two ways: `AXIsProcessTrusted`
(silent, for live state) and `AXIsProcessTrustedWithOptions` (prompts); it never touches Input
Monitoring. `AccessibilityMonitor` watches the `com.apple.accessibility.api` distributed
notification (30 s poll backstop) so the menu's grant row reacts to grant/revoke immediately.

**Menu UI** - `MenuContent.swift` (`.window` style `MenuBarExtra`): shows server status,
`host:port`, current pairing code, paired devices with per-device revoke, Accessibility state,
log viewer (bounded ring buffer of warnings/errors via `LogStore`), and open-at-login toggle.

**Settings** - `Settings.swift` persists the listen port in `UserDefaults`; menu-editable. A port
change restarts the `NWListener` and re-advertises Bonjour.

**Launch at login** - `LoginItem.swift` uses `SMAppService.mainApp` to register/unregister.

**Network-change re-advertise** - `NetworkMonitor.swift` (NWPathMonitor, debounced) re-registers
Bonjour when the Mac's LAN IP changes so the phone can rediscover after a network switch.

**Distribution** - `scripts/make-dmg.sh` builds a self-signed drag-and-drop DMG (no notarization);
users clear quarantine with `xattr -dr com.apple.quarantine`.

## Pairing & auth

`pair_request` -> helper shows a QR + high-entropy code (TTL <=120 s, brute-force lockout) -> phone
scans or types it and runs the pair handshake (`sec_hello` / `sec_hello_ack` / `sec_confirm` /
`sec_confirm_ack`). The code is mixed in as the psk, so a wrong code fails to decrypt
(`sec_error { bad_code }`, counted to the lockout); the token is issued *inside* `sec_confirm_ack`
(never a plaintext frame) and the phone pins the helper's static key. The lockout is actor-level
(`totalFailures` + exponential `lockedUntil`); spamming from a new connection cannot reset it; an
unexpired code is reused rather than rerolled. While a code is shown the helper pushes `pair_pending`
(remaining time only). On reconnect the phone runs the codeless NK handshake against the pinned key,
then sends `auth { token }` inside the encrypted channel -> `auth_ok` before any command. No
`command.execute`, `apps.list`, or `apps.icon` runs before auth (`requireAuth` on the Swift side,
`authPhase === 'paired'` on the mobile side). Post-handshake the helper accepts only `enc` and closes
on any plaintext, replay, or decrypt failure. Token + pinned key in `expo-secure-store`
(`lib/secure/token-store.ts`) with a stable `deviceId`; per-device revoke force-drops the live socket
via `ConnectionRegistry.closeIfDevice`.

Transport is `ws://` (not `wss://`) but every frame is app-layer encrypted, so this is not a
trusted-LAN-only design; TLS is unnecessary and RN's WebSocket exposes no TLS-trust hooks anyway.
Full spec: `docs/security.md`.

## Icon cache

`apps.slice.ts` requests icons lazily (on app-picker open or button assignment) via `apps.icon`.
`IconRenderer` (Swift) replies one icon per WS message (avoids Android large-frame OOM). The mobile
side caches in the `slate-icons` MMKV namespace keyed by `bundleId + iconVersion`
(`lib/icons/icon-cache.ts`); `hooks/useAppIcon.ts` serves from cache or fires a request.
`iconVersion` is the app bundle mtime so stale icons are automatically evicted on app update.

## Deck UI - `apps/mobile/src/components`

`DeckGestures` wraps the grid in a `GestureDetector` (`Gesture.Race`) with 1-finger horizontal pan
= page nav and 2-finger horizontal pan = deck nav. 2-finger for deck avoids fighting the long-press
edit gesture. `navRef` is attached via `.withRef` so a button swipe can call
`blocksExternalGesture(navRef)` to win over the page-nav pan; buttons without a swipe never attach
this, so default decks are unaffected. Gestures are disabled in edit mode.

`DeckButtonCell` has two code paths: `PressableScale` (fast, no RNGC overhead) when a button has
neither a double-tap nor any swipe; `GestureButton` (react-native-gesture-handler) otherwise. In
`GestureButton`: single tap (`maxDuration 250 ms`) and long-press (`minDuration 450 ms`) run
`Simultaneous`; double-tap uses `Gesture.Exclusive(doubleTap, single)` so single tap defers to a
second tap within 280 ms; swipe uses `Gesture.Pan` with `blocksExternalGesture`. View-mode
long-press fires `gestures.longPress`; editing is entered via the pencil toggle, not long-press.

`SortableGrid` (edit mode only): `Gesture.Pan().activateAfterLongPress(160 ms)` for drag-reorder;
`Gesture.Tap().maxDuration(200 ms)` in `Gesture.Exclusive(pan, tap)` so a quick tap opens the
editor before the drag arms. Reanimated shared values drive position; `useAnimatedReaction` slides
idle items to new slots as the drag rearranges `order`.

`DeckNavBar` (portrait; landscape uses a sidebar rail): deck chips + add-deck (+); page dots +
add-page (+); long-press a chip opens rename / auto-profile / delete sheet (`setDeckAutoProfile`
writes or clears `matchBundleId`).

The button editor (`app/deck/button/[id].tsx`) is reused for gesture-slot assignment: a `?slot=`
param selects a `GestureSlot`; the same command form builds the gesture's command and save calls
`editButton` with an updated `gestures` map. `quit_app` appears in the slot picker only, not the
primary action list. `GestureHandlerRootView` wraps the app root (`_layout.tsx`).
