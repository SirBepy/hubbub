---
name: capture
description: Drives Hubbub's screen + N controller clients through a join/play flow and screenshots each state, in one command.
---

# capture

> Reproduce a multi-client Hubbub playthrough (TV + host + guest phones) and screenshot each
> surface, without hand-writing a new Playwright script per game or per session.

Absorbs `capture-v3.cjs` / `capture-tap-race.cjs` (2026-08-01): those hardcoded one game's play
sequence per file. This skill is the same mechanics (per-player browser contexts, room-code
scrape, identity + join flow, console-error capture) driven by a JSON plan instead, so a new game
or a new shot list is a new plan file, not a new script.

## When NOT to use this

Single static page, no TV/controller pair, no join flow: use the global `/screenshot` skill
instead. This skill exists specifically for the screen+controller multi-client flow.

## Step 1 - Prereqs

- Script must exist at `.claude/skills/capture/scripts/capture.cjs`. If missing, stop and say so.
- Dev stack must already be running via `/supervised-run`: ws server on 7787, screen vite on
  5173, controller vite on 5174 (fixed ports, per `apps/screen/src/config-resolve.ts` - do not use
  dynamic ports). Start it first if it isn't up; this skill never starts servers itself.

## Step 2 - Pick the output directory

Same rule as every capture in this repo: `.for_bepy/screenshots/<claude-ancestor-pid>-<ancestor-start-ticks>/`.
Never write to the folder root. Create it if missing.

## Step 3 - Write the plan JSON

One plan = one browser session covering all pages (TV + every controller). Page ids: `"tv"` is
reserved for the screen app; any other string (`"host"`, `"guest"`, `"p3"`...) is a controller,
opened lazily on first reference so player count is just "however many ids you use". Each id gets
its own browser context, so there is no two-tab localStorage collision (see
`hubbub-local-dev-and-testing` memory).

```json
{
  "screenUrl": "http://localhost:5173",
  "controllerUrl": "http://localhost:5174",
  "steps": [
    { "type": "waitRoomCode" },
    { "type": "identity", "page": "host", "name": "Bepy", "color": "cyan", "emoji": "<pick emoji from picker>" },
    { "type": "join", "page": "host" },
    { "type": "identity", "page": "guest", "name": "Mira", "color": "magenta", "emoji": "<pick emoji from picker>", "shot": ".for_bepy/screenshots/x/identity-picker.png" },
    { "type": "join", "page": "guest" },
    { "type": "waitText", "page": "tv", "text": "2 connected" },
    { "type": "screenshot", "page": "tv", "out": ".for_bepy/screenshots/x/tv-lobby.png" },
    { "type": "clickRole", "page": "host", "role": "button", "name": "^Tic-Tac-Toe ", "exact": false },
    { "type": "clickRole", "page": "host", "role": "button", "name": "^Start ", "exact": false },
    { "type": "waitRole", "page": "host", "role": "button", "name": "Rematch" },
    { "type": "screenshot", "page": "tv", "out": ".for_bepy/screenshots/x/tv-endofround.png" }
  ]
}
```

`screenUrl`/`controllerUrl` default to the ports above if omitted. `viewport` may override the
`{ tv, controller }` defaults (1920x1080 / 390x844, matching a real TV and phone). `emoji` must be
the literal glyph shown on the picker button (it is the button's accessible name); copy it from
the running UI or from `capture-v3.cjs`'s prior art, don't guess a codepoint.

### Step types

| Type | Fields | Notes |
|---|---|---|
| `waitRoomCode` | `page` (default `tv`) | Scrapes the 4-char code off the TV DOM; run before any `join` |
| `identity` | `page`, `name`, `color`, `emoji`, `shot` (optional) | Fills the identity form; `shot` screenshots before Save (matches the color/emoji picker UI) |
| `join` | `page` | Fills room code (from `waitRoomCode`), clicks Join, waits for PICK A GAME |
| `screenshot` | `page`, `out` | Settles (`fonts.ready` + 400ms) then screenshots |
| `click` | `page`, `selector` | Raw CSS click |
| `clickRole` | `page`, `role`, `name`, `exact` | `getByRole(...).click()`; `name` is a substring/regex source when `exact:false` |
| `clickNth` | `page`, `selector`, `index` | `locator(selector).nth(index).click()` - use for grid cells (e.g. TTT board) |
| `waitText` | `page`, `text`, `exact`, `timeout` | `getByText(...).waitFor()` |
| `waitRole` | `page`, `role`, `name`, `exact`, `timeout` | `getByRole(...).waitFor()` |
| `wait` | `ms`, `page` (default `tv`) | Plain pause |
| `evaluate` | `page`, `js` | Runs `page.evaluate(js)` - `js` is a string, must be an IIFE |

Game-specific interaction (which cells to click, how many taps) is not abstracted further - each
game gets its own plan file, same as each game already needs its own capture script today. That
is the intended level of reuse: the join/identity/screenshot plumbing is shared, gameplay isn't.

## Step 4 - Run it

```
node "C:/Users/tecno/Desktop/Projects/hubbub/.claude/skills/capture/scripts/capture.cjs" --plan "<plan.json>" --out-dir ".for_bepy/screenshots/<session>"
```

One command, one browser session, all pages. On failure it dumps `debug-<pageId>.png` +
truncated DOM + console logs for every open page into `--out-dir` before exiting 1.

## Step 5 - Verify and report

Read each screenshot back: not blank, not mid-transition, room code actually 4 chars. Console
logs print per page id at the end on success too - scan for errors even when shots look fine.
