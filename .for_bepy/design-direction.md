# Hubbub v3 Design Direction

Research base: Mobbin sweep (AirConsole not indexed - see note below) + web search. 12 reference screenshots in `.for_bepy/design-refs/`. Read against the current v2 system in `.for_bepy/mockups/` (tokens.css, lobby-screen.html, game-tictactoe.html).

## AirConsole note

Not indexed on Mobbin. From [developer docs](https://developers.airconsole.com/js/app/partials/examples/controller_design.html) and [GamesIndustry coverage](https://www.gamedeveloper.com/design/airconsole---using-smartphones-as-controllers): controllers are deliberately **glanceable, not readable** - big touch targets sized for thumbs without looking down, because eyes stay on the TV. Round-based games (quizzes) can afford more controller chrome than twitch games (racing) because there's time to look down. This validates hubbub's "screen renders everything, phone is dumb" split - the controller should default to minimal, high-contrast, thumb-first hit targets, not mini versions of the screen UI.

## (a) What the refs do that v2 doesn't

1. **Timer as the hero shape, not a sidebar** - `deezer-quiz-timer-answers.png` puts a big circular countdown dead center above the answers, doubly encoding time (numeral + arc). v2's `game-music-guesser.html` (not yet reviewed in depth but per tokens.css pattern) likely treats timers as UI chrome. A center-stage timer is *the* thing that makes a quiz feel alive under pressure.
2. **A modal can carry a game's whole explanation without new chrome** - `deezer-rules-modal-overlay.png` dims the answer buttons underneath and drops a single-purpose overlay ("How does it work?" + one CTA). v2 has no established "how to play" pattern; every game currently assumes the player already knows the rules.
3. **Celebration is a moment, not a state** - `deezer-results-confetti.png` fires confetti, shows score/rank ("#5610 of 27753 players") and a scrollable breakdown, then two clear next actions (Challenge a friend / Play again). v2's win states are unknown/unbuilt - this is the pattern to build toward for every game's end screen.
4. **Leaderboards use ONE glow, on the viewer's own row** - `duolingo-leaderboard.png` highlights just the current player's row (bg tint), everyone else stays flat. This is literally the v2 tokens.css doctrine ("one glow per screen") applied to a screen hubbub hasn't built yet.
5. **Avatar/color identity is a first-class picker, not a footnote** - `duolingo-avatar-color-picker.png` and `reddit-avatar-customizer.png` give color/identity selection real screen real estate with a live preview beside the picker. v2's controller lobby likely just assigns an emoji+color; letting players *choose* deserves the same weight AirConsole gives round-based games (there's downtime in the lobby, use it).
6. **A per-surface accent color, not just per-player** - `discord-profile-theme-picker.png` separates "Primary" and "Accent" as two independently swatched roles. Hubbub's tokens.css has one shared `--accent` (cyan) for the whole product; nothing currently lets a *game* claim its own accent the way TTT claims cyan/magenta locally. This ref shows the pattern of a small, explicit 2-swatch picker rather than a full palette dump.
7. **Numbers as the graphic device, not just data** - `netflix-top10-giant-numbers.png` uses oversized numerals as the dominant visual shape (the ranking number, not the poster, is what your eye lands on). Hubbub's TTT scoreboard uses small numeral chips; a results/leaderboard screen could steal this trick to make rank feel dramatic without adding a new glow.
8. **Category rows scale a catalog without a wall of tiles** - `netflix-games-row-hover.png` and `hbomax-brand-spotlight-row.png` show two different scaling devices: horizontally-scrolling rows with hover-reveal metadata, and a row of small circular brand marks as pure identity/navigation. v2's lobby-screen.html uses one flat `auto-fill` grid - fine at 8 games, structurally wrong at 20+.

## (b) Concrete v3 recommendations, per surface

### TV Lobby (`lobby-screen.html`)
- **Fix dead vertical space**: the current layout is top-row + two flat sections with lots of unused space below the fold at 1080p once player count is low. Borrow the Netflix hero-row idea: give the *currently-hosted/suggested* game a taller "featured" tile (2x width or height) above the regular grid, sourced from the existing `.tile.focused` state - don't invent new chrome, just let the focused tile grow.
- **Players row**: keep the flat chip pattern (it already matches ref #4's "no glow except your own" doctrine) but reserve a highlighted variant for "you" when the screen is mirrored to a spectator display or during a per-player callout moment (ref #4).
- **Suggested-game badge** (already in v2, `.badge`): good instinct, matches Deezer's mode-select card treatment (ref #6, clear labeled choices). Keep it, don't add more badge types without a hierarchy pass.

### Phone Controller (`lobby-controller.html`)
- **Apply AirConsole's glanceability rule explicitly**: any control that needs pressing during a *timed* round (Music Guesser, Bluff Trivia) gets full-bleed, no-look tap targets - mirror `deezer-quiz-timer-answers.png`'s 4 stacked full-width buttons, not a grid. Grids are fine only for turn-based/no-timer games (TTT board).
- **Give the color/emoji picker a real screen**, not an inline row in the join flow - steal the "swatch grid + live preview" layout from `duolingo-avatar-color-picker.png` / `reddit-avatar-customizer.png`. Player identity is chosen once per session and remembered; it deserves one dedicated, unhurried screen during the join flow's dead time.
- **Add a compact rules/"how to play" bottom-sheet** triggered from the controller (ref #2) - currently nothing in v2 explains a game to a new player. One reusable `sdk` component, not per-game bespoke copy.

### Game Screens
- **Fix TTT board asymmetry**: current board is a bare 3x3 grid with no visual counterweight - the turn-banner + scoreboard are both centered above/below but nothing bookends the board horizontally, so it reads as a small object adrift in a big empty stage (see `.tv-panel { width: 720px }` in game-tictactoe.html, board is only 480px). Either shrink `.tv-panel` to hug the board width, or add symmetrical side rails (player identity cards left/right of the board, echoing the score chips but positioned as bookends, not stacked below).
- **Timer-driven games** (Music Guesser, Bluff Trivia, anything with `tickRateHz` or a countdown): put the countdown where Deezer puts it - large, centered, above the primary content, doubly-encoded (number + ring/bar). This is the single highest-leverage fix for "generic dark dashboard" feel - a big animated countdown is what makes a screen feel like a *game* instead of a form.
- **End-of-round/win screens**: every game needs the same 3-part end-state template - score/rank display (steal the giant-numeral trick, ref #7) + brief breakdown list + two actions (rematch / back to lobby). Build this once in `packages/sdk` or `packages/ui`, not per-game.

## (c) Future-facing

**Scaling to 20+ games**: flat grid breaks past ~12 tiles. Adopt Netflix/HBO's two-tier pattern: a **featured row** (1-3 tall tiles: last played, host-suggested, "new") above a **standard grid**, and once the catalog is large enough, category chips (Party / Quick / Strategy / Music) that filter the grid client-side - no server changes needed, it's pure client-side taxonomy on existing `meta` fields.

**Per-game identity - what varies vs. what's fixed**: Fixed across every game: surfaces (`--bg`/`--surface`/`--surface-raised`), type scale, spacing, the "one glow" rule, the 6 player colors. Variable per game: a single accent pairing (like TTT's cyan/magenta X/O) drawn from a curated subset of the *existing* 6 palette colors - never a 7th color, never a gradient. This is exactly the Discord "Primary/Accent, 2 swatches only" pattern (ref #6) applied at the game level instead of the profile level. A game's `GameDefinition` in `packages/sdk` could declare `identityColors: [token, token]` and the screen/controller views pull from that instead of hardcoding `--p-cyan`/`--p-magenta` like game-tictactoe.html does today.

**Motion/animation direction**: 
- *Always moves*: the countdown ring/bar during timed rounds (it's the tension), the confetti/celebration burst at round/game end (one-shot, never looping), a subtle pulse on "waiting for players" states (ref: Campsite's minimal dark waiting screen - text + nothing else, no spinner needed if the pulse is on the player avatar itself).
- *Never moves*: surfaces, borders, idle tiles, chips. No hover-float, no idle shimmer, no ambient gradient animation - that's what "disciplined" in "neon but disciplined" means, and Campsite's stripped-down waiting screen (just text, one avatar, no chrome) is the reference for how little a waiting state needs.
- *Sparingly, on state change only*: the focus-ring glow transition (`.tile.focused`) should animate in over ~150ms when a tile becomes host-suggested, never idle-pulse.

**Party-critical lesson (Kahoot/Deezer joining-is-alive pattern)**: the single biggest thing quiz platforms nail is that **the room visibly reacts the instant a player joins** - a chip appears, a sound cue fires, the player count ticks up in view of everyone. Hubbub's lobby already has the player chip list; the gap is *transition*, not layout - a new chip should animate in (slide+fade, ~200ms) rather than appear instantly, and the "Players · 12" counter should visibly increment. This is cheap to build (CSS transition + a counter tick) and it's disproportionately responsible for "this feels alive" versus "this is a dashboard."

## Reference image index

| File | What to steal |
|---|---|
| `deezer-mode-select.png` | Labeled mode cards (Solo/Multiplayer/Party) - badge/suggestion pattern validation |
| `deezer-quiz-timer-answers.png` | Center-stage circular timer + full-width stacked answers |
| `deezer-rules-modal-overlay.png` | Dimmed-background "how it works" modal, single CTA |
| `deezer-results-confetti.png` | End-state: score, rank, breakdown list, two actions |
| `duolingo-leaderboard.png` | One-glow-on-your-row leaderboard |
| `duolingo-avatar-color-picker.png` | Dedicated picker screen, live preview beside swatches |
| `reddit-avatar-customizer.png` | Category-tabbed customizer, dense color grid |
| `discord-profile-theme-picker.png` | Two-role (Primary/Accent) color system, not a full palette |
| `netflix-games-row-hover.png` | Horizontal row + hover-reveal metadata for scaling a catalog |
| `netflix-top10-giant-numbers.png` | Oversized numerals as the dominant graphic device |
| `hbomax-brand-spotlight-row.png` | Small circular identity marks as a navigation row |
| `campsite-waiting-for-others.png` | Minimal dark waiting state - text + one avatar, no spinner needed |
