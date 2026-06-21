# SwiftUI helper

`helpers/mac-helper` - the primary macOS backend. `MenuBarExtra` app, macOS 14+, Swift 6.2 strict
concurrency, non-sandboxed. Built from `project.yml` via xcodegen; `.xcodeproj` is gitignored.
Coding standards: `.claude/rules/swiftui.md`.

## Module map

```
SlateHelper/
  SlateHelperApp.swift      app entry, wires MenuBarExtra + starts WebSocketServer
  MenuContent.swift         menu UI (.window style): status, host:port, pairing code,
                            paired devices + revoke, Accessibility state
  Protocol/
    Protocol.swift          Codable mirror of @slate/protocol (envelope, Command, Capabilities)
    MessageCoding.swift     encode/decode helpers; reply ids are lowercased UUIDs
  Server/
    WebSocketServer.swift   NWListener WebSocket server role, binds all interfaces
    Connection.swift        per-peer receive loop (serialized); calls ClientSession
    ConnectionRegistry.swift  actor; enforces one active connection - newest replaces prior
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
    PairingService.swift    actor; 6-digit code, TTL <=120s, rate-limit after ~5 bad tries
    TokenStore.swift        actor; 32-byte token; 0600 JSON in Application Support; revoke
  Apps/
    AppEnumerator.swift     scans /Applications and standard app directories
    AppCatalog.swift        actor cache over AppEnumerator
  Icons/
    IconRenderer.swift      NSWorkspace.icon -> 256px PNG base64; one icon per WS message
  Networking/
    LocalAddress.swift      resolves LAN address for display in menu
  Permissions/
    PermissionProbe.swift   AXIsProcessTrustedWithOptions; result shown in menu
```

## Key decisions

**NWListener over URLSessionWebSocketTask** - server role requires NWListener with
`NWProtocolWebSocket`; URLSession is client-only.

**dns-sd C API for Bonjour** - `NWListener.Service` advertises on the wrong interface in some
macOS versions (FB14321888); `DNSServiceRegister` is the reliable alternative.

**Single active connection** - `ConnectionRegistry` closes the prior peer when a new one connects.
Simplifies auth state; slate is a 1-phone-1-Mac tool.

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
