---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript

Strict, fully typed. The shared `tsconfig.base.json` is law — honor every flag.

## Types

- No `any` (Biome errors on it). No loose types, no `as` to silence the compiler, no `!`
  non-null abuse — narrow instead.
- `noUncheckedIndexedAccess` is on: array / record access is `T | undefined` — guard it.
- `exactOptionalPropertyTypes` is on: don't assign `undefined` to optional props; omit the key
  or type it `T | undefined`.
- `verbatimModuleSyntax` is on: use `import type` / `export type` for type-only imports.
- Prefer `type` aliases + discriminated unions. Derive types (`z.infer`, `Pick`), don't duplicate.

## State — Zustand

- One root store. Each slice is a `StateCreator<RootState, [], [], Slice>` in its own file; the
  root spreads them in `create<RootState>()((...a) => ({ ...createXSlice(...a) }))`.
- The **curried** `create<T>()(...)` form is mandatory for inference.
- Middleware only at the root, order `devtools(persist(immer(...)))`. `partialize` the persisted subset.
- Persist via an MMKV `StateStorage` adapter with an AsyncStorage fallback. The auth token lives
  in `expo-secure-store`, never in the store.
- Read with atomic selectors; multi-field picks use `useShallow` from `zustand/react/shallow`.
  Never select the whole store object.

## Validation — Zod

- Schemas are the source of truth; derive types with `z.infer`. No parallel hand-written interface.
- Top-level `z.email()`, `z.uuid()`, `z.iso.datetime()` — not the deprecated method chains.
- Validate every external input (WS messages, storage reads) with `safeParse` at the boundary;
  on failure log + drop, never propagate unvalidated data.

## Structure

- Modular + DRY: small single-responsibility files; extract shared logic once.
- Clean up every listener / timer / subscription / socket / async task (effect cleanup or
  `AbortController`). No leaks.
