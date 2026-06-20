---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
---

# React Native / Expo

Expo SDK 56 / RN 0.85. New Architecture is mandatory — never try to disable it; every native
dependency must be New-Arch compatible.

## Structure

- File-based routing under `src/app/`; `_layout.tsx` files define navigators, not screens.
- Non-route code as siblings: `components/`, `hooks/`, `stores/`, `lib/`, `schemas/`, `types/`.
- Alias `@/*` → `./src/*`. Shared wire types come from `@slate/protocol`.
- Per-package `biome.json`: `{ "root": false, "extends": "//" }` plus
  `linter.domains.react: "recommended"` and `javascript.globals: ["__DEV__"]`. Per-package
  `tsconfig.json` extends `../../tsconfig.base.json` and `expo/tsconfig.base`.

## Performance & memory (low RAM, small bundle)

- Hermes is default; tree-shaking is on — ESM only, import `Platform` directly (re-exporting it
  defeats platform-shaking).
- FlashList v2 for lists > ~10 items; `expo-image` with `allowDownscaling` and a sane `cachePolicy`.
- Production: strip `console.*` via Terser `drop_console` in `metro.config.js`.
- React Compiler is opt-in; do not hand-memoize without a measured bottleneck.
- **No memory leaks (hard rule):** every `addEventListener` / `setInterval` / `subscribe` /
  `WebSocket` / `fetch` has a matching cleanup in the `useEffect` return or via `AbortController`.
  The WS client is a singleton in `src/lib/ws/`, closed on teardown.

## Transport

- The app builds a semantic `Command` and hands it to a `Transport` — it never calls platform
  logic directly (this keeps the backend pluggable).
- JSON-level `ping` / `pong` heartbeat (RN can't send WS protocol pings); reconnect with backoff;
  reject commands while offline with a toast, never drop silently.
