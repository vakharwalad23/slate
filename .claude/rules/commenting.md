# Comment style

No doc comments (`///`, `/** */`, JSDoc). No narration (`// loop over items`, `// create the
listener`). No commented-out code.

Write a comment **only** for:

- a **trade-off** — why this approach over the obvious alternative
- a **non-obvious decision** — intent the code itself cannot show
- a **boundary / contract** — ordering requirements, invariants, units, caller obligations

One line where possible. The code says *what*; a comment exists only when *why* isn't visible.
Applies identically to TypeScript and Swift.
