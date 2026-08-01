---
name: create-game
description: "Triggers on /create-game <idea> only. Scaffolds a new Hubbub game as its own sibling repo from the GitHub template, registers it in the platform, and writes a kickoff prompt for implementation."
argument-hint: "<game idea>"
---

# /create-game

> Scaffold a new Hubbub game as a sibling git repo from `hubbub-game-template`, wire it into the platform's `games-manifest`, and hand off implementation.

Runs from the `hubbub` repo root. Windows/PowerShell throughout: one command per
call, never chain with `&&` / `;` / `|`. Never raw `git commit` - only the `/commit`
skill commits (subagents can't invoke skills; if executing as a subagent, stage and
stop before Step 6, handing commit back to the main agent). After every `pnpm`
command touching Node, orphan-check per the global rules
(`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).

## Step 0 - derive metadata

From the user's idea prompt, decide:

- `gameId`: lowercase kebab-case, npm-safe (e.g. `trivia-blitz`).
- `PascalId`: PascalCase of `gameId` (capitalize each hyphen segment, drop hyphens -
  `trivia-blitz` -> `TriviaBlitz`).
- Display name, one-line description.
- `category`: one of Party / Strategy / Music / Quick.
- `minPlayers` / `maxPlayers`.
- `identityColors`: a pair of DISTINCT indexes 0-5 into the fixed palette
  `[0 magenta, 1 cyan, 2 lime, 3 amber, 4 violet, 5 blue]` (see `packages/protocol/src/messages.ts`
  `PLAYER_COLOR_NAMES`). Pick colors matching the game's role structure (e.g. two
  fixed sides like X/O get their own pair); free-for-all games with no fixed roles
  reuse the pair as `[leaderGlowColor, winBannerColor]` accent slots, per the
  template sample's convention - document that reuse with a short comment same as
  `hubbub-game-template/src/screen.tsx` does.
- Controller interaction shape: timed/full-bleed single-button (like the sample's
  `GlowButton` tap target) vs a grid of choices - whichever matches the idea.
  **Dual-input rule (Joe, 2026-08-01): phones are not the only controllers** - keyboard
  and gamepad are first-class future inputs (spec section 9). Design every interaction
  as logical actions a D-pad can drive: cursor + select over free-pointer taps, discrete
  choice grids over sliders/gestures, text entry only where genuinely unavoidable (e.g.
  pasting a URL) and never on the core play loop.
- Visual identity: **every game gets its own background treatment, distinct from the
  lobby and from other games** (Joe, 2026-08-01: "i dont want the color palette to look
  the same for every game"). CSS-only (no image assets): e.g. identityColors-tinted
  gradients, a subtle thematic motif in pure CSS. Still bound by the design rules -
  tokens/colorHex only, surfaces never animate, one glow per view.

Only ask the user (AskUserQuestion, per global rules) if the idea is genuinely
ambiguous on a product-level fork (e.g. turn-based vs real-time changes the whole
architecture). Otherwise proceed without asking.

## Step 1 - scaffold the sibling repo

Destination: `..\hubbub-game-<gameId>` (sibling of `hubbub`, i.e.
`C:\Users\tecno\Desktop\Projects\hubbub-game-<gameId>`).

Abort with a clear message if the destination already exists (`Test-Path ..\hubbub-game-<gameId>`).

Preferred (online):
```
gh repo clone SirBepy/hubbub-game-template ..\hubbub-game-<gameId>
Remove-Item -Recurse -Force ..\hubbub-game-<gameId>\.git
git -C ..\hubbub-game-<gameId> init -b main
```

Offline fallback (copy the local sibling template folder, excluding `.git`,
`node_modules`, `pnpm-lock.yaml`):
```
robocopy ..\hubbub-game-template ..\hubbub-game-<gameId> /E /XD .git node_modules /XF pnpm-lock.yaml
git -C ..\hubbub-game-<gameId> init -b main
```
(`robocopy` exit codes 0-7 are success, not just 0 - don't treat nonzero as failure
without checking.)

## Step 2 - re-token the copy

Files touched: `package.json`, `README.md`, `CLAUDE.md`, `KICKOFF.template.md`,
`src/logic.ts`, `src/logic.test.ts`, `src/screen.tsx`, `src/controller.tsx`.

**PowerShell's `-replace` is case-INSENSITIVE by default** - use `-creplace`
(case-sensitive) for every token below, or `Sample`/`sample` variants will
cross-contaminate each other. Replace most-specific-first so shorter tokens don't
clobber longer ones that contain them:

1. `SampleScreenProps` -> `<PascalId>ScreenProps`
2. `SampleControllerProps` -> `<PascalId>ControllerProps`
3. `SampleState` -> `<PascalId>State`
4. `SampleAction` -> `<PascalId>Action`
5. `sampleLogic` -> `<gameId camelCase>Logic` (e.g. `triviaBlitzLogic`)
6. `SampleScreen` -> `<PascalId>Screen`
7. `SampleController` -> `<PascalId>Controller`
8. `@hubbub/game-sample` -> `@hubbub/game-<gameId>`
9. `Sample Game` -> `<Display Name>`
10. `\bSample\b` (remaining capitalized whole-word prose the earlier rules didn't
    catch, e.g. `CLAUDE.md`'s "Sample content in this repo..." lead sentence) ->
    `<Display Name>`
11. `\bsample\b` (remaining lowercase whole-word prose, e.g. the `describe("sample game logic", ...)` string) -> `<gameId>`

Example per-file pattern (repeat per file above, adjust replacements per file - not
every file has every token):
```
$p = "..\hubbub-game-<gameId>\src\logic.ts"
(Get-Content $p -Raw) -creplace 'SampleState','<PascalId>State' -creplace 'SampleAction','<PascalId>Action' -creplace 'sampleLogic','<camelId>Logic' | Set-Content $p -NoNewline
```

Then edit `src/logic.ts`'s `meta` object directly (Edit tool) to set
`minPlayers`, `maxPlayers`, `category`, `identityColors` from Step 0.

## Step 3 - baseline verify (new repo, BEFORE any real implementation)

Use `pnpm --dir` to avoid changing the working directory:
```
pnpm --dir ..\hubbub-game-<gameId> install
pnpm --dir ..\hubbub-game-<gameId> typecheck
pnpm --dir ..\hubbub-game-<gameId> test
```
All three must pass on the renamed sample game alone. Do NOT remove the
`pnpm.overrides` block in the new repo's `package.json` - it resolves the
`file:../hubbub/packages/*` deps and is load-bearing.

## Step 4 - kickoff docs

Render `KICKOFF.template.md` -> `KICKOFF.md`, filling `{{GAME_NAME}}` `{{GAME_ID}}`
`{{GAME_CONCEPT}}` `{{PLAYERS}}` `{{CATEGORY}}` `{{IDENTITY_COLORS}}` from Step 0,
then delete the `.template` file:
```
Remove-Item ..\hubbub-game-<gameId>\KICKOFF.template.md
```

Append a `## This game` section (concept, decided meta, any product decisions from
Step 0) at `CLAUDE.md`'s `{{GAME_NOTES}}` marker in the new repo, replacing the
marker.

## Step 5 - register in hubbub

All edits below are inside the `hubbub` repo (this repo).

1. `packages/games-manifest/package.json` - add a dependency line:
   `"@hubbub/game-<gameId>": "link:../../../hubbub-game-<gameId>"`
   (three `../` because `games-manifest` is two levels under the hubbub root, plus
   one more to reach the sibling `hubbub-game-<gameId>` folder next to `hubbub`).
   **Verified (first execution, `tap-race`):** use `link:` - pnpm resolves it as an
   NTFS junction on Windows (`Get-Item packages\games-manifest\node_modules\@hubbub\game-<gameId>`
   shows `LinkType: Junction`), which needs no elevated/Developer Mode permissions
   (junctions ≠ symlinks). `pnpm install`, `pnpm -w typecheck`, `pnpm -w test`, and
   `pnpm -w build` all passed clean with a `link:`-registered game. Live edits in the
   game repo are reflected immediately (junction, not a copy) - no `file:` fallback
   needed.
   No `pnpm-workspace.yaml` change needed - `link:`/`file:` deps resolve by path,
   bypassing the workspace glob (`packages/*`, `apps/*`, `packages/games/*`), which
   is why sibling-repo games don't need to live under `packages/games/`.
2. One line each, following the existing `ttt`/`uttt` pattern exactly:
   - `src/logics.ts`: import `<camelId>Logic` from `@hubbub/game-<gameId>`, add
     `<gameId>: <camelId>Logic` to `GAME_LOGICS`.
   - `src/screens.ts`: import `<PascalId>Screen` from `@hubbub/game-<gameId>/screen`,
     add `<gameId>: <PascalId>Screen as ScreenComponent` to `GAME_SCREENS`.
   - `src/controllers.ts`: import `<PascalId>Controller` from
     `@hubbub/game-<gameId>/controller`, add
     `<gameId>: <PascalId>Controller as ControllerComponent` to `GAME_CONTROLLERS`.
   `manifest.test.ts` enforces the three key sets match - a missed line fails it.
3. Verify floor at hubbub root (each its own command):
```
pnpm install
pnpm -w typecheck
pnpm -w test
pnpm -w build
```

## Step 6 - git + GitHub for the new repo

Initial commit via the `/commit` skill - never raw `git commit`. If running as a
subagent (can't invoke skills), stage changes and stop here, handing back to the
main agent for the commit.

Then, from the main agent, after commit:
```
gh repo create SirBepy/hubbub-game-<gameId> --private --source ..\hubbub-game-<gameId> --push
```
**Warn the user before this runs** - it can trigger a GitHub credential/auth popup;
per the popup-attribution rule, tell them it came from this `gh repo create --push`
command if it appears.

Hubbub-side registration changes (Step 5) get committed in `hubbub` via a separate
`/commit` call - the two repos never share a commit.

## Step 7 - mockup gate (BEFORE any implementation)

Joe approves visuals before real code gets written - always (see the
"disciplined design taste" project memory: mockup-approval loop before real code).
Run `/mockup` for the game's two views (screen + controller, phone-framed for the
controller), reusing `@hubbub/ui` tokens/components and honoring the design
one-liners in Notes below. Show Joe the result and wait for his approval; iterate
on his feedback. Only a user prompt that explicitly says to skip visuals (e.g.
"no mockup, just build it") bypasses this gate - full-auto/autonomous mode does NOT
bypass it: if Joe is AFK, stop after the mockup and park implementation until he
reacts. The approved mockup files/screenshots become part of the builder's brief in
Step 8.

## Step 8 - hand off implementation

Two modes:

- **(a) Same-session (default unless the user said otherwise):** dispatch a
  builder subagent with `KICKOFF.md` + the approved Step 7 mockup as its brief,
  working in `..\hubbub-game-<gameId>`. Subagents stage but never commit - the
  dispatch prompt must say so explicitly, per the global rule.
- **(b) Next-session:** tell the user the repo is ready and that a fresh session
  started in `..\hubbub-game-<gameId>` should begin with "read KICKOFF.md and
  build".

## Notes

- **Palette** (`packages/protocol/src/messages.ts` `PLAYER_COLOR_NAMES`): `0` magenta,
  `1` cyan, `2` lime, `3` amber, `4` violet, `5` blue.
- **Design one-liners** (full rules in the new repo's `CLAUDE.md`): tokens only via
  `@hubbub/ui` (`var(--surface-*)`, `colorHex(colorId)`) - never a raw hex; exactly
  one glowing element per screen view and one per controller view
  (`GlowButton` is the only glow); phone tap targets >= 44px both dimensions;
  surfaces never animate, only borders/glow/content; no CDN, no new font imports -
  local LAN mode has no internet.
- **Platform-update contract:** if a game needs something from `@hubbub/sdk`,
  `@hubbub/protocol`, or `@hubbub/ui` that doesn't exist, change it in `hubbub`
  directly (never fork/vendor into the game repo) - see the new repo's `CLAUDE.md`
  "Updating the platform" section for the exact verify-and-commit sequence.
- **Template repo:** `SirBepy/hubbub-game-template` on GitHub (private, marked as a
  template repo), local sibling copy at `..\hubbub-game-template`. When the SDK API
  changes (`GameLogic`, view prop shapes), the template's sample game and its
  `CLAUDE.md` API quick-reference go stale - edit the template repo directly and
  push; this skill's re-tokening list (Step 2) may also need updating if identifier
  names in the template change.
