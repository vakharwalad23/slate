# slate

Phone-based Stream Deck for macOS over the local network. A React Native / Expo app drives a
Mac via WebSocket + JSON; a macOS helper (Node MVP -> Swift menu-bar app) executes commands.
Full build spec: `plan.md` (gitignored); the SSH backend is v2.

## Layout (pnpm monorepo)

- `apps/mobile` - Expo SDK 56 app (TypeScript)
- `packages/protocol` - shared TS types + JSON Schema, the wire contract
- `helpers/node-helper` - Node `ws` MVP helper -> later `helpers/mac-helper` (Swift)
- `docs/` - human docs | `.claude/` - rules, skills, agents, hooks

## Commands

- `pnpm check` - Biome format + lint + import sort (writes fixes)
- `pnpm lint` / `pnpm format` - lint-only / format-only
- Commits go through Husky: Biome on staged files (pre-commit) + commitlint (commit-msg)
- Repo / PR operations: use the `gh` CLI

## Always

- TypeScript strict, fully typed - no `any`, no loose types
- Modular + DRY; small single-responsibility files
- Clean up every listener / timer / subscription / socket - no memory leaks
- Conventional Commits, 1-2 lines, **no Co-authored-by trailer**
- Comments only for a trade-off, decision, or boundary/contract

## Never

- Add a dependency for what a few lines do; add speculative abstractions
- Disable the New Architecture (mandatory in Expo SDK 55+)
- Commit secrets, `plan.md`, or local config

## Rules (auto-loaded from `.claude/rules/`, path-scoped - do not duplicate here)

`typescript.md` | `react-native-expo.md` | `swiftui.md` | `commenting.md` | `git-commits.md`

## Docs (`docs/`)

`react-native-expo.md` | `code-logic.md` | `doc-flow.md` | `swiftui.md`

<!-- Keep this file under ~80 lines. Procedures belong in skills; standards belong in rules. -->
