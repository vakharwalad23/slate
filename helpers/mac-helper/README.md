# slate helper (macOS menu-bar app)

The macOS backend for slate: a SwiftUI `MenuBarExtra` app that advertises itself on the local
network over Bonjour and runs the actions your phone sends over a WebSocket. Target: macOS 14+,
Swift 6.2, non-sandboxed, local-network only (no notarization).

## Project layout

The Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yontra/XcodeGen),
so the source files are plain and reviewable and the `.xcodeproj` is reproducible.

```
brew install xcodegen        # one time
cd helpers/mac-helper
xcodegen generate            # writes SlateHelper.xcodeproj
```

## Build and run

```
open SlateHelper.xcodeproj
```

1. Select the `SlateHelper` target -> Signing and Capabilities -> Team = your personal team,
   "Automatically manage signing" on. Bundle id `com.slate.helper`.
2. Build and Run (Cmd-R). The app has no Dock icon; a menu-bar item appears.
3. The first time a phone connects, macOS shows the Local Network prompt -> Allow.
4. To use `activate_app`: System Settings -> Privacy and Security -> Accessibility -> enable
   "SlateHelper". Other actions (launch app, run shortcut, run AppleScript) do not need it.
5. The first `run_applescript` / `run_shortcut` triggers the Automation prompt -> Allow.

A stable signing identity (real team + fixed bundle id) keeps the Accessibility grant across
rebuilds. Do not switch to ad-hoc signing for day-to-day use.

## Command-line build and test

```
xcodebuild -project SlateHelper.xcodeproj -scheme SlateHelper -destination 'platform=macOS' build
xcodebuild -project SlateHelper.xcodeproj -scheme SlateHelper -destination 'platform=macOS' test
```

## Protocol parity checklist

`SlateHelper/Protocol/Protocol.swift` hand-mirrors `packages/protocol`. When the protocol version
bumps, diff it against the generated schema (`pnpm -F @slate/protocol gen:schema`) and update both:

- Envelope keys: `v` (Int, must equal the protocol version), `id` (uuid), `reId` (uuid or null).
- Message discriminant: `type`. Command discriminant: `kind`.
- Messages handled or emitted: `hello` -> `hello_ack`, `ping` -> `pong`,
  `command.execute` -> `command.result`. Other types decode to `unknown` and are dropped.
- Commands: `launch_app`, `activate_app`, `run_shortcut`, `run_applescript`, `run_shell`.
- Capabilities flags: `launchApps`, `runShortcuts`, `runShell`, `keystrokes`, `appList`,
  `appIcons`, `liveState`.

Reply `id`/`reId` are lowercased uuids; a reply whose `id` is not a valid uuid is dropped by the
phone at its validation boundary.

## Build a release DMG

```
scripts/make-dmg.sh
```

Archives Release, takes the `.app` from the archive, ad-hoc signs it (self-signed, no Developer ID,
no notarization), and packages a drag-and-drop `build/slate-helper.dmg`. Publish it next to the
Android APK on a GitHub release (`gh release create ...`).

## Installing a released build (self-signed, not notarized)

Released builds are self-signed and not notarized. After dragging `SlateHelper.app` to
Applications from the DMG, clear the download quarantine once:

```
xattr -dr com.apple.quarantine /Applications/SlateHelper.app
```

Then launch it normally.
