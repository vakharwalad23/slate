---
name: rn-expo
description: Scaffold React Native / Expo code to slate's house style — a route/screen, a typed Zustand slice, a Zod schema, or the WebSocket transport. Use when adding a new screen, store slice, schema, or RN module to apps/mobile.
---

# rn-expo scaffolding

Generate RN/Expo code matching `.claude/rules/react-native-expo.md` and
`.claude/rules/typescript.md`. Pick the task, follow the steps, keep files small and fully typed.

## Add a screen / route

1. Create `src/app/<path>.tsx` (or `(group)/<name>.tsx`; `[param].tsx` for dynamic segments).
2. Default-export the component. Navigators belong in the directory's `_layout.tsx`, not the page.
3. Read state via atomic selectors; wrap multi-field picks in `useShallow`.

## Add a Zustand slice

1. `src/stores/slices/<name>.slice.ts` exporting `type <Name>Slice` and
   `createNameSlice: StateCreator<RootState, [], [], <Name>Slice>`.
2. Add the slice type to `RootState` and spread `createNameSlice(...a)` in `src/stores/store.ts`.
3. Persist via `partialize` only if it must survive restart. No business logic in components.

## Add a Zod schema

1. `src/schemas/<name>.schema.ts`: define the schema, then `export type X = z.infer<typeof XSchema>`.
2. Use top-level `z.email()` / `z.uuid()`. Validate inbound data with `safeParse` at the boundary.

## Touch the transport

- Build a semantic `Command`; never call platform logic in a component. The socket stays a
  singleton in `src/lib/ws/` with cleanup. Add a JSON `ping` / `pong` if introducing a new connection.

After scaffolding: run `pnpm check`, then update `docs/` (or run `/doc-sync`).
