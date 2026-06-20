# ASCII-only text

Use only ASCII characters (code points 0x00-0x7F) in all source, comments, commit
messages, and documentation. No typographic / Unicode characters anywhere. When tempted
to use one, write the ASCII equivalent instead:

- em dash / en dash -> hyphen `-`
- curly single/double quotes -> straight `'` and `"`
- ellipsis character -> three dots `...`
- right/left arrow -> `->` / `<-`
- less-or-equal / greater-or-equal / not-equal symbols -> `<=` / `>=` / `!=`
- middot or bullet separator -> `|` or `,`
- section sign -> the word `section`
- box-drawing characters -> ASCII `+`, `-`, `|`
- emoji / status glyphs -> short ASCII labels, e.g. `[blocker]`, `[ok]`, `[x]`, `[ ]`

Applies identically to TypeScript, Swift, JSON, Markdown docs, and `.claude/` config.
Rationale: clean greppable diffs, no copy-paste/encoding surprises, consistent rendering
in every terminal and editor. To check a file: `rg -c '[^\x00-\x7F]' <path>` must be 0.
