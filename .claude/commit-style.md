# Commit style

Inherits the global `/commit` defaults - prefixes (`FEAT:`, `FIX:`, `REFACTOR:`, `CHORE:`,
`DOCS:`, `TEST:`, `STYLE:`, `DATA:`), one purpose per commit, pathspec commits, no AI attribution.
Only the overrides below differ.

## Never fold; the overlap check is expected to hit here

**`/commit`'s unpushed-overlap check will report real hunk-level hits on almost every commit in
this repo, and the answer is always "genuinely separate". Do not ask, do not `reset --soft`, do
not fold.** Proceed with a separate commit and note the overlap in one line.

Why this repo specifically: `develop` carries a long unpushed series, and the platform is a small
set of packages (`protocol`, `sdk`, `ui`, `relay`, `games-manifest`) that every task reaches
through. A todo that touches the relay, the screen and a shared token is one finished unit of
work, and the next one necessarily rewrites lines it wrote. A hunk-level hit here means "the same
file changed again", never "this is a draft of that commit".

Settled 2026-09-02, matching the call made for `hubbub-game-music-guesser` on 2026-08-24, where
the overlap check fired on 7 of 24 unpushed commits at once.

Folding stays available if Joe explicitly names a sha (`/commit fold <sha>`). What is off is the
automatic prompt.

## Scope

Platform changes are committed here, never mixed into a game repo's commit. The reverse of the
game repos' own rule: a game's `logic.ts` / `screen.tsx` / `controller.tsx` change belongs in that
game's repo, even when it is the reason a platform change was made.
