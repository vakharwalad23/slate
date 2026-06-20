# Commits

- **Conventional Commits**: `type(scope): subject`. Types: `feat`, `fix`, `chore`, `refactor`,
  `docs`, `test`, `build`, `ci`, `perf`, `style`.
- Subject ≤72 chars, imperative mood, no trailing period.
- Body: 0–2 short lines, only when the *why* isn't obvious from the subject. No walls of text.
- **Never** add a `Co-authored-by` trailer or any attribution footer.
- One commit per logical change; commit as you go.
- Repo / PR / release operations: use the `gh` CLI.
- Enforced automatically: `commitlint` (commit-msg) checks the format; Biome (pre-commit) checks style.
