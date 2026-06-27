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

## Protocol parity (enforced by tests)

`SlateHelper/Protocol/{Protocol,MessageCoding}.swift` hand-mirrors `packages/protocol`. The Zod
schema (`packages/protocol/src`) is the single source of truth; the generated JSON Schema and this
Swift port are pinned to it by one shared fixture set, `packages/protocol/fixtures/messages.json`,
so a drift fails a build instead of the wire.

On any protocol change:

1. Edit the Zod schema, then regenerate the JSON Schema: `pnpm -F @slate/protocol gen:schema`.
2. Add or adjust the matching frame in `fixtures/messages.json` (one valid frame per message type
   and per command kind, plus the malformed cases).
3. Update this Swift port to match, then make all of these green:
   - `pnpm verify` - runs `gen:schema --check` (the committed JSON Schema must equal the Zod
     output) and the TS conformance test (every fixture parses or rejects as declared).
   - `xcodebuild -scheme SlateHelper test` - `ProtocolConformanceTests` decodes every inbound
     fixture, encodes every outbound fixture, and asserts the malformed and unknown-type cases
     drop as designed.
4. If the wire format changes incompatibly, bump `PROTOCOL_VERSION` on both sides in lockstep (the
   `v` field is covered by the fixtures).

Direction matters: Swift decodes inbound (App -> Helper) frames and encodes outbound
(Helper -> App) frames; an unrecognized `type` decodes to `unknown` and is dropped. Reply
`id`/`reId` are lowercased uuids; uuid format is validated at the phone boundary, not in Swift.

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
