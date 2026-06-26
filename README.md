<div align="center">

<img src="apps/mobile/assets/icon.png" width="120" alt="slate" />

# slate

**A programmable Stream Deck for your Mac, driven from your phone. Local network only - nothing leaves your Wi-Fi.**

[![macOS](https://img.shields.io/badge/macOS-14%2B-000?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![app: iOS | Android](https://img.shields.io/badge/app-iOS%20%7C%20Android-1b1f24?logo=expo&logoColor=white)](#requirements)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2056-149ECA?logo=react&logoColor=white)](https://expo.dev)
[![Swift](https://img.shields.io/badge/helper-Swift%206.2-F05138?logo=swift&logoColor=white)](https://www.swift.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/vakharwalad23/slate?logo=github)](https://github.com/vakharwalad23/slate/stargazers)

</div>

---

slate turns your phone into a programmable Stream Deck for a Mac. The phone shows a grid of
buttons; tapping one sends a command over a WebSocket on your LAN, and a small native macOS
menu-bar helper runs it on the Mac - launch an app, focus an app, run a macOS Shortcut, run
AppleScript. Buttons render the real macOS app icons, pulled live from the Mac. Local-network only,
with secure pairing.

Built with React Native / Expo (one app for iOS and Android) and a native Swift menu-bar helper.

## Why slate?

Most phone-as-deck apps route through a vendor cloud, lock you to one mobile platform, or show
generic icons. slate is local-network only - no account, no relay, nothing leaves your Wi-Fi - runs
on both iOS and Android from one codebase, and renders the real macOS app icons pulled live from
your Mac. Pairing is a 6-digit code plus a per-device token you can revoke at any time.

## Features

- **Real macOS app icons, live.** Buttons show each Mac app's actual Finder icon, pulled live from
  the Mac and cached on the phone - not generic glyphs.
- **Local network only, no cloud.** Everything runs over your LAN via WebSocket. No account, no
  relay, nothing leaves your Wi-Fi.
- **Secure pairing.** A 6-digit code shown on the Mac plus a per-device token; rate-limited with
  lockout, and every device is revocable from the helper menu.
- **iOS and Android.** One app, both platforms.
- **Portrait and a landscape dock mode.** Stand the phone sideways and it becomes a control surface
  with a side rail.
- **Light and dark theme.** Follow-system or manual.
- **Flexible buttons.** Launch an app, focus a running app, run a macOS Shortcut, or run AppleScript.
  Three icon sources per button: the Mac app icon, an emoji, or a built-in glyph.
- **Auto-discovery and resilience.** Bonjour / mDNS plus a subnet scan find the Mac automatically
  (manual host:port always available); auto-reconnect with backoff, and it follows the Mac to a new
  IP after a network change.
- **A real menu-bar helper.** Server status, pairing code, paired-device list with revoke, a logs
  panel, a configurable port, and launch-at-login.

## How it works

```
   PHONE (the app)                 LAN                 MAC (the helper)
+---------------------+     WebSocket + JSON     +-------------------------+
|  React Native /     | <----------------------> |  Swift menu-bar app     |
|  Expo deck UI       |                          |  (NWListener server)    |
|  builds a Command   | --- command.execute ---> |  runs the macOS action  |
+---------------------+                          +-------------------------+
```

The app never calls OS logic directly - it builds a semantic `Command` and hands it to a transport,
so the backend stays pluggable behind a single interface.

## Project layout

A pnpm monorepo.

| Path | What |
| --- | --- |
| `apps/mobile` | Expo SDK 56 app (TypeScript) - the deck UI |
| `packages/protocol` | Shared TS types + JSON Schema - the wire contract |
| `helpers/mac-helper` | Swift menu-bar helper (the primary macOS backend) |
| `helpers/node-helper` | Node `ws` MVP helper (proves the loop; `launch_app` only) |
| `docs/` | Architecture, stack, code-logic, and flow docs |

## Requirements

- Node `>=22` (see `.node-version`) and pnpm `10.x`.
- macOS 14+ with Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen) to build the Swift
  helper.
- For the phone app, an Expo dev build (Expo Go cannot load slate - it uses native modules):
  - iOS: Xcode + the iOS Simulator.
  - Android: Android Studio / a device, plus either EAS (cloud build) or a local native build.

## Build and run from source

There are no prebuilt downloads yet (see Releases below) - build it yourself.

### 1. Clone and install

```sh
git clone https://github.com/vakharwalad23/slate.git
cd slate
pnpm install
```

### 2. Run the Mac helper

Option A - the Swift menu-bar app (recommended):

```sh
brew install xcodegen
cd helpers/mac-helper
xcodegen generate
open SlateHelper.xcodeproj
```

In Xcode, set Signing to your own team, then Build and Run (Cmd-R). The app has no Dock icon -
look for the menu-bar item. Allow the Local Network prompt on first connect. To use `activate_app`,
enable SlateHelper under System Settings -> Privacy and Security -> Accessibility (the other actions
do not need it).

Option B - the Node MVP helper (quick, `launch_app` only):

```sh
pnpm -F @slate/node-helper start    # ws://0.0.0.0:8765
```

### 3. Run the phone app

```sh
# iOS simulator (local)
pnpm -F @slate/mobile ios

# Android: build a dev client, then install it on a device
#   cloud build (no Android SDK needed):
eas build --profile preview --platform android
#   or a local native build (needs the Android SDK):
pnpm -F @slate/mobile android
```

### 4. Pair and use

Open the app. It auto-discovers the helper (or enter host:port manually), then tap Pair and type the
6-digit code shown in the Mac menu. Add buttons, pick an action and icon, and tap to run them on the
Mac.

## Security

slate is local-network only. v1 uses `ws://` plus a per-device token on a trusted network: tokens
are not encrypted in transit, so there is no protection against MITM or replay on an untrusted LAN.
Pairing is rate-limited with lockout, and devices are revocable from the helper. WSS with a
self-signed certificate pinned at pairing time is planned for v2. Do not expose the helper's port to
untrusted networks.

## Development

```sh
pnpm check                       # Biome: format + lint + import sort
pnpm -F @slate/mobile type-check # TypeScript
pnpm -F @slate/node-helper test  # Node helper tests
# Swift helper tests:
#   xcodebuild -project helpers/mac-helper/SlateHelper.xcodeproj -scheme SlateHelper \
#     -destination 'platform=macOS' test
```

Conventional Commits; Husky runs Biome (pre-commit) and commitlint (commit-msg). All source,
comments, and docs are ASCII-only.

## Upcoming (v2)

Shipping after the public release:

- More actions: keystrokes, switch Spaces, app switching, media keys, multi-step macros, quit app,
  guarded shell commands, and Shortcut input piping.
- Per-button gestures (swipe and long-press mapped to commands).
- Multiple pages / folders, a deck switcher, and drag-to-reorder.
- Auto profile switching - the deck follows the Mac's foreground app (live state).
- WSS with certificate pinning at pairing.
- A notarized DMG and prebuilt downloads (see below).
- Discovery reliability improvements.

## Releases and downloads

Prebuilt binaries (an Android APK and a macOS DMG) will be published with the v2 release. For now,
build from source using the steps above.

## Contributing

Contributions are very much welcome - open an issue or a pull request. Please follow Conventional
Commits and the ASCII-only rule (see Development above), and make sure `pnpm check` and the
type-check pass. `main` is protected: changes land via pull request, not direct pushes.

## Docs

See [`docs/`](./docs): [React Native / Expo](./docs/react-native-expo.md) |
[code logic](./docs/code-logic.md) | [flows](./docs/doc-flow.md) |
[SwiftUI helper](./docs/swiftui.md).

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 Dhruv Vakharwala.
