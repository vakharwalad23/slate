# slate

Turn your phone into a programmable Stream Deck for a Mac, over the local network.

A React Native / Expo app drives a Mac via WebSocket + JSON. A macOS helper executes the
commands — a Node.js helper first (to prove the loop), then a native Swift menu-bar app.
Local-network only, secure pairing, real macOS app icons on the buttons.

## Layout

This is a pnpm monorepo.

| Path | What |
| --- | --- |
| `apps/mobile` | Expo SDK 56 app (TypeScript) — the deck UI |
| `packages/protocol` | Shared TS types + JSON Schema — the wire contract |
| `helpers/node-helper` | Node `ws` MVP helper (later: `helpers/mac-helper`, Swift) |
| `docs/` | Architecture, stack, code logic, and flow docs |

> Source packages land in later passes. This repo currently holds the project
> foundation: tooling, conventions, and the `.claude/` workspace config.

## Prerequisites

- Node `>=22` (see `.node-version`)
- pnpm `10.x`

## Setup

```sh
pnpm install
pnpm check      # Biome: format + lint + import sort
```

Commits run Biome (pre-commit) and commitlint (commit-msg) via Husky.

## Docs

See [`docs/`](./docs): [React Native / Expo](./docs/react-native-expo.md) ·
[code logic](./docs/code-logic.md) · [flows](./docs/doc-flow.md) ·
[SwiftUI](./docs/swiftui.md).
