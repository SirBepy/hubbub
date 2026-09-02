# Hubbub - Project State & Next Steps (handoff)

> Written 2026-06-24 for whoever continues the build. This is the single orientation
> doc: what Hubbub is, what's done, what's next, and the rules you must not break.
> Read this, then the design spec, then the relevant plan. Everything is on branch
> `master` (local-only repo, no remote).

---

## 1. What Hubbub is

An open-source, self-hostable party-game platform (think Jackbox, but self-hostable and
extensible). A **big screen** (TV/laptop browser) runs the game; **phones are dumb
controllers** that join via room code or QR. Real-time capable. Runs in a zero-cost
**local LAN mode** (an Electron host app) and a future hosted **cloud mode**. It is a
*framework* many games are built on.

**Authoritative design:** `docs/superpowers/specs/2026-06-24-hubbub-party-game-framework-design.md`.
Read it. The build order (Phases 0-6) lives there.

---

## 2. Architecture invariants (DO NOT violate)

These are load-bearing. Breaking one is a real regression, not a style nit.

- **Transport is a swappable interface** (`packages/protocol`). WebSocket (`ws`) is the
  default impl; WebRTC is a future impl behind the SAME interface. Game/SDK/app code must
  NEVER import a concrete transport - only the interface / SDK helpers.
- **The phone is a dumb controller; the screen renders everything.** Inputs pay one-way
  latency (phone -> screen), never a round trip.
- **A game implements only three parts** (`GameLogic<State, Action>` in `packages/sdk`):
  server logic, screen view, controller view. The framework owns rooms, join/leave, state
  sync, input routing, reconnection, lobby, QR, and local/cloud transport.
- **Input = logical actions, never raw keys.** Actions are validated by a per-game Zod
  `actionSchema`.
- **Per-game authority:** turn-based games omit `tickRateHz` and are server-authoritative;
  real-time games declare `tickRateHz` and run a screen-authoritative loop. (No real-time
  game exists yet - that's Phase 4.)
- **Local vs cloud is one config flag** (server endpoint + QR target). Game code identical
  in both modes.
- **Offline LAN = NO CDNs.** Bundle all assets (icons, fonts) into the apps. Local mode
  has no internet. (Currently the apps are self-contained Vite builds - keep them so.)
- **Reconnect tokens** per player (already in the protocol) so a WiFi blip reclaims a slot.

Full rules also in the root `CLAUDE.md` (project section) - read it.

---

## 3. Repo layout & commands

pnpm + Turborepo monorepo, TypeScript everywhere, Node 22+, **concurrency capped at 5**.

```
/apps
  screen          big-screen app (lobby + game renderer) - Vite/React, dev port 5173
  controller      phone PWA - Vite/React, dev port 5174
  server          Node `ws` room server - dev port 7787
  host-desktop    Electron host: bundles server + both web apps into a portable .exe
/packages
  protocol        message envelope, Zod schemas, ClientTransport interface, reconnect tokens
  sdk             GameLogic contract (types.ts) + GameInstance runtime + /react helpers
  games/tictactoe          plain Tic-Tac-Toe (the Phase 1 proof game)
  games/ultimate-tictactoe Ultimate TTT - logic DONE, views+wiring PENDING (see section 5)
```

- **Install:** `pnpm install`
- **Typecheck:** `pnpm typecheck` (currently 8 packages, expect all ok)
- **Test:** `pnpm test` (Vitest; currently 55 tests = 44 prior + 11 uttt logic)
- **Build:** `pnpm build`
- **Dev stack (LAN):** `pnpm dev:all` (screen 5173, controller 5174, server ws 7787).
  Per Joe's process rules, long-lived servers should go through the `/supervised-run` skill.
- **Electron host (dev):** `pnpm host:dev` (opens the screen window, serves controller on
  the LAN at `:7780`, ws on `:7787`).
- **Portable build:** `pnpm host:package` -> `apps/host-desktop/release/Hubbub-portable.exe`.

Ports: WS **7787**, host controller HTTP **7780**, host screen HTTP **7781** (8787/5173/5174
are dev defaults; 8787 was taken on Joe's machine, hence 7787).

---

## 4. What's DONE

- **Phase 0** - monorepo skeleton, `protocol` (transport iface + Zod + reconnect tokens),
  `ws` transport, bare room (create/code/join/player-list/broadcast).
- **Phase 1** - `GameLogic` runtime (`GameInstance`), server-authoritative path, input
  routing + validation, event-driven state sync, lobby/QR, local/cloud config helpers,
  and plain **Tic-Tac-Toe** end-to-end (two players, win detection, game-over lockout).
- **Phase 3** - **portable Electron host** (`apps/host-desktop`). Boots the `ws` server +
  two static HTTP servers (controller bound `0.0.0.0` for phones; screen bound `127.0.0.1`
  for the Electron window), detects LAN IP, injects `{serverUrl, controllerUrl}` into the
  screen via a `contextBridge` preload, and electron-builder produces a **portable .exe**
  (no installer). Plan: `docs/superpowers/plans/2026-06-24-phase-3-electron-host.md`.
  The .exe builds; the Electron window + real-phone hop are pending manual tests (see
  `.for_bepy/BEPY_TODOS.md`). Decision made with Joe: portable .exe now, cloud later;
  phones always zero-install.
- **Ultimate TTT - Task 1 (logic)** - `packages/games/ultimate-tictactoe` logic + 11
  passing tests, committed (`c5ed132`), reviewed and approved (rules verified correct by a
  reviewer trace). See section 5 for what remains.

Note: Phase 2 in the spec was *meant* to be Ultimate TTT as the first game, but Phase 1
shipped *plain* TTT as the proof. Ultimate TTT is now being added as the real second game.

Verified state at handoff: **8 packages typecheck, 55 tests pass, full build + portable
exe build succeed.**

- **Dependency audit (2026-08-19, todo 57)** - `pnpm audit` went from 29 advisories (2
  critical, incl. Electron and the root vitest pin) to 0. Electron, vite (controller/
  screen/web) and root vitest all took clean major/minor bumps; `electron-builder`'s
  transitive tar/js-yaml/fast-uri/brace-expansion/postcss/nanoid chain is pinned via
  `pnpm.overrides` in the root `package.json` (same shape as the existing undici entry).
  See `vitest.config.ts`'s comment for why the vitest bump was safe.

---

## 5. What's NEXT - finish Ultimate Tic-Tac-Toe

**Plan with full code for every remaining step:**
`docs/superpowers/plans/2026-06-24-ultimate-tictactoe.md`. Tasks 2-4 each have exact file
contents. Task 1 is done. Do Tasks 2, 3, 4 in order.

- **Task 2 - Views.** Create `packages/games/ultimate-tictactoe/src/screen.tsx`
  (`UTTTScreen`) and `controller.tsx` (`UTTTController`), mirroring the tictactoe views.
  The plan has the full JSX. Verify: `pnpm --filter @hubbub/game-ultimate-tictactoe typecheck`.
- **Task 3 - Server game selection + integration test.** Add `@hubbub/game-ultimate-tictactoe`
  dep to `apps/server`; make `apps/server/src/index.ts` pick the game from `HUBBUB_GAME`
  (`ttt`|`uttt`, default `ttt`); add `apps/server/src/server.uttt.test.ts` (ws round-trip
  playing a uttt move, asserting `activeBoard`/turn update). Full code in the plan.
- **Task 4 - App game selection.** Add the dep to `apps/screen` + `apps/controller`; create
  a `game.tsx` registry in each that picks the view by `import.meta.env.VITE_GAME`
  (default `ttt`); rewire both `App.tsx` to use `GameScreen`/`GameController` and
  `useGameState<any>` / `createActionSender<any>`. **Default stays `ttt`** so Phase 3's
  pending phone tests still show plain TTT. Full code in the plan.

**Run Ultimate TTT live:** the `HUBBUB_GAME`/`VITE_GAME` env switches are retired. Every
app now bundles all games and the host picks one from the lobby game picker at runtime, so
just start the stack normally and select Ultimate TTT (or any game) on the screen.

### Open review findings on Task 1 (address during Task 2-4 or note)

From the Task 1 review (non-blocking, logic is correct):
- `logic.test.ts` "ignores a move on an occupied cell" and "ignores a spectator's move"
  assert values but NOT referential equality. Strengthen to `const s2 = move(s1, ...);
  expect(s2).toBe(s1)` so a `return {...state}` regression (instead of `return state`)
  would be caught. (~2-line tweak; the orchestrator was about to do this when work paused.)
- No test for the **overall-draw** terminal state (all 9 boards decided, no big-board
  line). The code handles it (`logic.ts`: `bigBoard.every(r => r !== null) ? "draw"`); the
  brief deemed a test optional because the steering sequence is long. Add if cheap.

---

## 6. Deferred / open decisions (need Joe, or a later phase)

- **Lobby / game-picker UI.** How players choose a game is an unbuilt UX decision. The
  `HUBBUB_GAME`/`VITE_GAME` env switch is a stopgap so games are runnable/testable. The
  spec floats a multi-game launcher as a later item. **This is a [UX] call - Joe decides.**
- **Wire `HUBBUB_GAME` into the Electron host** (`host-desktop/host.ts` currently defaults
  to plain TTT) once the lobby/selection UX is decided. Trivial after that.
- **Phase 4 - real-time path:** `tickRateHz` + screen-authoritative loop, `TiltPad`/motion
  (needs LAN HTTPS / secure-context strategy - undecided), WebRTC DataChannel behind the
  transport interface. Done = a Flappy-style prototype feels responsive.
- **Phase 5 - cloud:** deploy server + screen over wss, public room URLs (private rooms +
  rate-limited/non-enumerable join codes per the spec). Needs hosting + Joe's accounts;
  not AFK-friendly. Game code runs unchanged.
- **Content (Phase 6+):** Music Guesser (**audio source = Deezer, never Spotify** - see
  spec/CLAUDE.md), then verify-then-build Spotify Stats, then port Split Opinions, then
  keyboard/gamepad input + tests, then public SDK + sandboxing.
- **Host port robustness:** the controller's WS port is hardcoded `7787`; a collision on a
  friend's machine has no fallback yet. Host window polish: default Electron icon, no
  fullscreen/Wake-Lock wiring yet.
- **Product name** is still the codename `hubbub`; `LICENSE` copyright holder is the
  placeholder `Joe` - both to settle before any public release. License = MIT.

---

## 7. Conventions you must follow

- **Commits:** ALWAYS via the `/commit` skill, never `git commit` directly. One logical
  change per commit. Prefixes: `FEAT/FIX/REFACTOR/CHORE/DOCS/TEST/STYLE/DATA`. No AI
  attribution lines.
- **Subagents NEVER commit.** If you orchestrate with subagents, each stages its changes
  and the main agent runs `/commit` after the report-back. (Subagents can't invoke skills.)
- **Shell:** Windows. Prefer PowerShell; one command per call; never chain with `&&`/`;`/`|`.
- **No em-dash characters anywhere** (use comma/colon/hyphen). (Joe's rule.)
- **Process hygiene:** long-lived servers via `/supervised-run`; never leave orphan node
  processes; cap concurrency at 5.
- **Testing floor before claiming done:** run every fast check the repo has - `pnpm
  typecheck`, `pnpm test`, `pnpm build` - all must pass.
- **TDD** for logic: write the failing test, see it fail, implement, see it pass.
- **Mirror existing patterns** (the tictactoe package is the template for new games).

---

## 8. Suggested workflow for continuing

1. `pnpm install` then `pnpm typecheck` (8 ok) + `pnpm test` (55 pass) to confirm baseline.
2. Execute Tasks 2 -> 3 -> 4 from the Ultimate TTT plan (each ends in a `/commit`).
3. After Task 4: full `pnpm typecheck` + `pnpm test` + `pnpm build`; optionally a live
   `VITE_GAME=uttt` playthrough in the browser.
4. When the implementer (Odysseus or otherwise) is done, a **code-review pass** is
   recommended before considering it merged - Joe will decide who runs it.
5. The scratch ledger for the in-flight orchestration is at
   `.superpowers/sdd/progress-uttt.md` (git-ignored); the Ultimate TTT plan is the source
   of truth.
