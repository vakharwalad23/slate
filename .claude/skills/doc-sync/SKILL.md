---
name: doc-sync
description: Bring docs/ back in sync after code changes. Use after editing source under apps/, packages/, or helpers/, or whenever the user asks to update or sync docs.
---

# doc-sync

Keep `docs/` consistent with the code. Update succinctly — these are reference docs, not changelogs.

## Steps

1. See what changed:
   !`git status --porcelain && echo '---' && git diff --stat`
2. Map each changed area to its doc:
   - `apps/mobile/**`, stack / structure / state → `docs/react-native-expo.md`
   - module responsibilities / decisions → `docs/code-logic.md`
   - cross-component flows, message sequences → `docs/doc-flow.md`
   - `helpers/mac-helper/**`, Swift → `docs/swiftui.md`
3. Edit only the affected doc(s). Match the existing terse style; don't restate the spec (`plan.md`).
4. For a large or multi-area change, delegate to the `doc-sync` agent.
5. Stage the doc edits alongside the related code change (same commit).

Do not create new doc files — the four in `docs/` are fixed. If one grows unwieldy, propose a split.
