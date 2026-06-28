# React Native / Expo

The phone app. Human-readable companion to `.claude/rules/react-native-expo.md` and
`.claude/rules/typescript.md`. Update this whenever the app's stack, structure, or state
shape changes.

## Stack

- **Expo SDK 56** (React Native 0.85, React 19.2). New Architecture is mandatory - no opt-out.
- **expo-router** (SDK-aligned version) for file-based routing.
- **Zustand** for state (single store, typed slices). **Zod** for boundary validation.
- **react-native-mmkv** for persistence (AsyncStorage fallback); auth token in **expo-secure-store**.
- **expo-image**, **@shopify/flash-list** v2 for media/lists. **expo-splash-screen** for the
  branded splash. App icon: deck-grid (indigo) adaptive foreground/monochrome via `expo-image`.
- **react-native-gesture-handler** + **react-native-reanimated**: gesture tree for the deck grid
  (`DeckGestures` 1-/2-finger pan, `DeckButtonCell` tap/long-press/double-tap/swipe,
  `SortableGrid` drag-reorder with spring animations). `GestureHandlerRootView` wraps the app
  root (`src/app/_layout.tsx`).
- WebSocket: React Native built-in (no library). Discovery: manual host:port first; auto-discovery
  runs an mDNS browse plus a `/24` subnet WS-handshake scan (`lib/discovery/`), since
  react-native-zeroconf is unavailable on the New Arch Android build. After repeated reconnect
  misses, `lib/discovery/rediscovery.ts` browses by stored `helperName` and follows the helper to a
  new IP (network-change auto re-sync).

Requires an Expo **dev build** (`expo prebuild`) - Expo Go cannot load the native modules.

## Folder structure (`apps/mobile/`)

```
src/
  app/                 expo-router routes (file-based); _layout.tsx = navigators
  components/          reusable UI (ui/ atomic, domain/ compound)
  hooks/               custom hooks
  stores/
    slices/            one file per slice (StateCreator)
    store.ts           composed root store (curried create<T>()(...))
    index.ts           re-exports
  lib/
    ws/                WebSocket transport (singleton client + reconnect)
    discovery/         subnet-scan (/24 WS probe) + zeroconf (mDNS); rediscovery.ts follows
                       the helper to a new IP after repeated reconnect misses
    utils/             pure helpers
  schemas/             Zod schemas (runtime validation at boundaries)
  types/               TS-only types not exported from @slate/protocol
```

Config files (`app.json`, `metro.config.js`, `babel.config.js`, `tsconfig.json`) stay at the
package root. Path alias `@/*` -> `./src/*`.

## State (Zustand)

Single root store composed of typed slices using the curried `create<RootState>()(...)` form
(required for TS inference with middleware). Middleware order: devtools -> persist -> immer.
Persist only what's needed via `partialize`. Select atomically; use `useShallow`
(`zustand/react/shallow`) for multi-field picks. Never subscribe to the whole store.

## Validation (Zod)

Schemas are the source of truth; derive types with `z.infer`. Use top-level `z.email()` /
`z.uuid()` (not the deprecated `z.string().email()`). Validate every inbound wire message with
`safeParse` at the transport boundary - never trust raw socket data.

## Performance & memory

- Hermes is the default engine; tree-shaking is on (ESM only - import `Platform` directly).
- FlashList v2 for any list > ~10 items; `expo-image` with `allowDownscaling`.
- Strip `console.*` in production via Terser `drop_console` in `metro.config.js`.
- React Compiler is opt-in; memoize only on measured bottlenecks.
- **No leaks:** every listener, timer, subscription, socket, and fetch is cleaned up in a
  `useEffect` return / via `AbortController`. The WS socket is a singleton in `lib/ws/`, closed
  on teardown.
