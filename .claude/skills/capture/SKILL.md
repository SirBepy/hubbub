---
name: capture
description: Drives Hubbub's screen + N controller clients through a join/play flow in a real browser and screenshots each state. Use this whenever a task says screenshot the app, drive the app, play a round, verify in a browser, or reach an end-of-round screen - reach for this before hand-writing a new Playwright script.
---

# capture

> Reproduce a multi-client Hubbub playthrough (TV + host + guest phones) and screenshot each
> surface, without hand-writing a new Playwright script per game or per session.

**A subagent cannot invoke a skill.** If you are an orchestrator dispatching this work to a
builder subagent, hand it this file's script path and plan format explicitly in the prompt -
the subagent will never discover this skill on its own.

Absorbs `capture-v3.cjs` / `capture-tap-race.cjs` (2026-08-01) and four hand-rolled
`.for_bepy/verify-*.cjs` drivers (2026-08-05/06) that re-derived the same join flow. This skill
is the same mechanics (per-player browser contexts, room-code scrape, identity + join flow,
console-error capture) driven by a JSON plan instead, so a new game or a new shot list is a new
plan file, not a new script.

## When NOT to use this

Single static page, no TV/controller pair, no join flow: use the global `/screenshot` skill
instead. This skill exists specifically for the screen+controller multi-client flow.

## Step 1 - Prereqs

- Script must exist at `.claude/skills/capture/scripts/capture.cjs`. If missing, stop and say so.
- Dev stack must already be running via `/supervised-run`. This skill never starts servers.
  There are three legitimate targets, picked via `--base-url` / plan fields, never hardcoded:
  - **`apps/web` on 5175 - the DEFAULT.** This is the live production app (welcome -> avatar ->
    join, one origin, role auto-detected by viewport/pointer). No flags needed for this target.
  - `wrangler dev` (8788) or a deployed URL: same single-origin flow, pass `--base-url`.
  - Legacy standalone `apps/screen` (5173) + `apps/controller` (5174): set `screenUrl` /
    `controllerUrl` in the plan (see Step 3). No welcome screen on this pair.

## Step 2 - Pick the output directory

Same rule as every capture in this repo: `.for_bepy/screenshots/<claude-ancestor-pid>-<ancestor-start-ticks>/`.
Never write to the folder root. The script enforces this itself: if you omit `--out-dir`, it
requires `--session-id <pid>-<ticks>` or a `HUBBUB_CAPTURE_SESSION_ID` env var and derives the
path from that; give it neither and it refuses to run rather than defaulting to the root. A
subagent cannot walk its own ancestor process tree, so the orchestrator must pass this in.

## Step 3 - Write the plan JSON

One plan = one browser session covering all pages (TV + every controller). Page ids: `"tv"` is
reserved for the screen app; any other string (`"host"`, `"guest"`, `"p3"`...) is a controller,
opened lazily on first reference so player count is just "however many ids you use". Each id gets
its own browser context, so there is no two-tab localStorage collision (see
`hubbub-local-dev-and-testing` memory).

```json
{
  "baseUrl": "http://localhost:5175",
  "steps": [
    { "type": "waitRoomCode" },
    { "type": "identity", "page": "host", "name": "Bepy", "emoji": "<pick character label from picker>" },
    { "type": "join", "page": "host" },
    { "type": "identity", "page": "guest", "name": "Mira", "emoji": "<pick character label from picker>", "shot": ".for_bepy/screenshots/x/identity-picker.png" },
    { "type": "join", "page": "guest" },
    { "type": "waitText", "page": "tv", "text": "Mira" },
    { "type": "screenshot", "page": "tv", "out": ".for_bepy/screenshots/x/tv-lobby.png" },
    { "type": "playToEndOfRound", "page": "host", "tvPage": "tv", "game": "Tic-Tac-Toe", "shot": ".for_bepy/screenshots/x/tv-endofround.png" }
  ]
}
```

`baseUrl` defaults to `http://localhost:5175` if omitted; `--base-url` on the CLI overrides it.
Set `screenUrl`/`controllerUrl` instead to switch to the legacy 5173/5174 standalone pair - doing
so opts the whole plan into legacy mode. `viewport` may override the `{ tv, controller }` defaults
(1920x1080 / 390x844, matching a real TV and phone; controller contexts are always
`isMobile`+`hasTouch` so `apps/web`'s role auto-detection lands on "controller"). Player colour is
no longer user-facing anywhere in the product, so the identity plan carries no `color` field -
avatars alone carry identity now. `emoji` must be the character's exact `label` (e.g. "bear head"),
which is that picker button's accessible name (its `title` attribute, since the button's own
content is an SVG/emoji glyph with no text); copy it from the running UI or from
`packages/sdk/src/avatars/{game-icons,fluent-emoji,twemoji}.ts`. Omit `emoji` to auto-pick the
first enabled avatar when the exact character doesn't matter.

`identity` and `join` already handle `apps/web`'s welcome screen ("Continue as guest") when
present, and skip it automatically on the legacy controller app where it doesn't exist - no plan
field needed either way.

### Step types

| Type | Fields | Notes |
|---|---|---|
| `waitRoomCode` | `page` (default `tv`) | Scrapes the 4-char code off the TV DOM; run before any `join` |
| `identity` | `page`, `name`, `emoji` (optional), `shot` (optional) | Welcome -> fills identity form; `shot` screenshots before Save |
| `join` | `page` | Fills room code (from `waitRoomCode`), clicks Join, waits for the lobby ("Search games") |
| `screenshot` | `page`, `out` | Settles (`fonts.ready` + 400ms) then screenshots |
| `click` | `page`, `selector` | Raw CSS click |
| `clickRole` | `page`, `role`, `name`, `exact` | `getByRole(...).click()`; `name` is a substring/regex source when `exact:false` |
| `clickNth` | `page`, `selector`, `index` | `locator(selector).nth(index).click()` - use for grid cells (e.g. TTT board) |
| `waitText` | `page`, `text`, `exact`, `timeout` | `getByText(...).waitFor()` |
| `waitRole` | `page`, `role`, `name`, `exact`, `timeout` | `getByRole(...).waitFor()` |
| `pollUntilText` | `page`, `text`, `exact`, `timeout`, `interval`, `shot` | Polls instead of a fixed sleep; screenshots the instant the text appears, not after a guessed delay |
| `startGame` | `page`, `game` | Lobby search -> vote -> start for a named game row |
| `playToEndOfRound` | `page` (host, default `host`), `tvPage` (default `tv`), `game`, `endText`, `timeout`, `shot` | `startGame` then polls the TV for a win/draw/rematch marker (default `WINS\|DRAW\|Rematch\|PLAYS`) |
| `throttle` | `page`, `downloadThroughput`, `uploadThroughput`, `latency`, `offline` | CDP `Network.emulateNetworkConditions`; defaults to a slow-3G-ish profile |
| `unthrottle` | `page` | Clears any throttle set on that page |
| `wait` | `ms`, `page` (default `tv`) | Plain pause - prefer `pollUntilText` when waiting for a state, not a duration |
| `evaluate` | `page`, `js` | Runs `page.evaluate(js)` - `js` is a string, must be an IIFE |

Board/cell interaction inside a round (which cells to click) is not abstracted further - each
game's move-by-move logic still needs its own steps or a one-off script importing the exports
below. `playToEndOfRound` covers games that resolve on their own once started; it does not click
game-specific board cells for you.

## Step 4 - Run it

```
node "C:/Users/tecno/Desktop/Projects/hubbub/.claude/skills/capture/scripts/capture.cjs" --plan "<plan.json>" --session-id "<pid>-<ticks>"
```

`--out-dir <dir>` also works if you already have the resolved absolute path. One command, one
browser session, all pages. On failure it dumps `debug-<pageId>.png` + truncated DOM + console
logs for every open page into `--out-dir` before exiting 1.

### Reusing the primitives from a one-off script

For cases the plan schema doesn't cover (custom per-game board logic, bespoke assertions), import
rather than re-derive:

```js
const { resolvePlaywright, getRoomCode, joinRoom, doIdentity, playToEndOfRound } =
  require('.claude/skills/capture/scripts/capture.cjs');
```

Also exported: `startGame`, `pollUntilText`, `setThrottle`, `clearThrottle`, `firstEnabledEmoji`,
`settle`, `shot`. Room-code extraction and join must exist in exactly one place in this repo -
this file is that place.

## Step 5 - Verify and report

Read each screenshot back: not blank, not mid-transition, room code actually 4 chars. Console
logs print per page id at the end on success too - scan for errors even when shots look fine.
