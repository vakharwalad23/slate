# SwiftUI helper

`helpers/mac-helper` - the primary macOS backend. `MenuBarExtra` app, macOS 14+, Swift 6.2 strict
concurrency, non-sandboxed. Built from `project.yml` via xcodegen; `.xcodeproj` is gitignored.
Coding standards: `.claude/rules/swiftui.md`.

## Module map

```
SlateHelper/
  SlateHelperApp.swift      app entry, wires MenuBarExtra + starts WebSocketServer
  MenuContent.swift         menu UI (.window style): status, host:port, pairing code,
                            paired devices + revoke, Accessibility state, log viewer
  App/
    LoginItem.swift         SMAppService open-at-login toggle (menu item)
    Settings.swift          listen port persisted in UserDefaults; menu-editable;
                            changing restarts listener and re-advertises Bonjour
    LogStore.swift          bounded ring buffer of warnings/errors shown in menu
                            (server/bonjour/login errors + command/auth warnings)
  Protocol/
    Protocol.swift          Codable mirror of @slate/protocol (envelope, Command, Capabilities)
    MessageCoding.swift     encode/decode helpers; reply ids are lowercased UUIDs
  Server/
    WebSocketServer.swift   NWListener WebSocket server role, binds all interfaces
    Connection.swift        per-peer receive loop (serialized); calls ClientSession
    ConnectionRegistry.swift  actor; enforces one active connection - newest replaces prior;
                              closeIfDevice() used by revoke to force-drop the live connection
  Dispatch/
    ClientSession.swift     actor; per-connection auth state; routes all inbound message types
  Discovery/
    BonjourAdvertiser.swift dns-sd C API (DNSServiceRegister) for _slate._tcp
                            NWListener.Service avoided - FB14321888
  Commands/
    CommandExecutor.swift   maps Command kinds to macOS actions (see below)
    AppActivator.swift      NSRunningApplication activate + frontmost-verify + retry
                            (macOS 26 Tahoe focus quirk)
    ProcessRunner.swift     injectable shell runner; keeps CommandExecutor unit-testable
  Auth/
    PairingService.swift    actor; 6-digit code, TTL <=120s; actor-level totalFailures +
                            exponential lockedUntil (brute-force-resistant); unexpired code
                            reused on repeat pair_request rather than rerolled
    TokenStore.swift        actor; 32-byte token; 0600 JSON in Application Support; revoke
                            calls ConnectionRegistry.closeIfDevice to drop the live socket
  Apps/
    AppEnumerator.swift     scans /Applications and standard app directories
    AppCatalog.swift        actor cache over AppEnumerator
  Icons/
    IconRenderer.swift      NSWorkspace.icon -> 256px PNG base64; one icon per WS message
  Networking/
    LocalAddress.swift      resolves LAN address for display in menu
    NetworkMonitor.swift    NWPathMonitor (debounced) re-advertises Bonjour when the Mac's
                            LAN IP changes so a phone on a new network can rediscover
  Permissions/
    PermissionProbe.swift   AXIsProcessTrustedWithOptions; result shown in menu
```

Assets: `Assets.xcassets` includes a macOS `AppIcon.appiconset` (deck-grid, indigo) matching the
mobile adaptive icon.

## Key decisions

**NWListener over URLSessionWebSocketTask** - server role requires NWListener with
`NWProtocolWebSocket`; URLSession is client-only.

**dns-sd C API for Bonjour** - `NWListener.Service` advertises on the wrong interface in some
macOS versions (FB14321888); `DNSServiceRegister` is the reliable alternative.

**Single active connection** - `ConnectionRegistry` closes the prior peer when a new one connects.
Simplifies auth state; slate is a 1-phone-1-Mac tool. `closeIfDevice` is also called on revoke so
the kicked device's socket is dropped immediately.

**Brute-force-resistant pairing lockout** - `PairingService` tracks `totalFailures` and
`lockedUntil` at actor level. The lockout is exponential and cannot be reset by spamming
`pair_request` from a new connection. An unexpired code is reused rather than rerolled.
`scripts/brute-force-pairing.test.mjs` validates the behaviour.

**Launch at login** - `LoginItem.swift` uses `SMAppService.mainApp` to register/unregister the
open-at-login item; toggled from the menu.

**Configurable listen port** - `Settings.swift` persists the port in `UserDefaults`. Changing it
restarts the `NWListener` and triggers a fresh Bonjour advertisement.

**Network-change re-advertise** - `NetworkMonitor.swift` debounces `NWPathMonitor` path updates
and calls `BonjourAdvertiser` to re-register when the Mac's LAN IP changes, keeping the helper
discoverable after a network switch.

**In-menu log viewer** - `LogStore.swift` is a bounded ring buffer; server, Bonjour, login-item
errors and command/auth warnings are appended via `HelperServices.onLog` and shown in `MenuContent`.

**Two-pass envelope decode** - decode `type` first, then decode the full message as the matching
concrete type. Mirrors the TS side's discriminated union approach without reflection.

**`activate_app` retry loop** - macOS 26 Tahoe does not always move focus on the first
`NSRunningApplication.activate()` call; `AppActivator` polls `frontmost` and retries up to
a small bound before returning an error.

**Non-sandboxed** - required for `open -a`, `NSRunningApplication` control, AppleScript, and
Shortcuts invocation. Distributed as a self-signed DMG; users clear quarantine with
`xattr -dr com.apple.quarantine`.

## Command kinds (v1)

| kind | macOS action |
|------|-------------|
| `launch_app` | `open -a <name>` then `-b <bundleId>` fallback |
| `activate_app` | `NSRunningApplication` activate + frontmost verify |
| `run_shortcut` | Shortcuts via `shortcuts run` |
| `run_applescript` | `osascript -e` |

## Distribution

`scripts/make-dmg.sh` produces a drag-and-drop DMG, self-signed (no notarization). Users must
run `xattr -dr com.apple.quarantine SlateHelper.app` after copying to `/Applications`.
