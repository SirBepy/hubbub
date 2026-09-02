# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **partygoers in a living room.** Five to twelve people, physically together, some
drinking, phones already in hand. One person (the host) owns the room and drives the TV; the
rest join by scanning a QR or typing a four-letter code. Nobody installs anything, nobody
reads instructions, and attention is split between the TV, the phone, and the conversation in
the room. A player may arrive mid-session, hand their phone to someone else, or lose WiFi.

Secondary, served by docs rather than by the UI: developers who self-host Hubbub or build a
game on the SDK.

## Product Purpose

An open-source, self-hostable party-game platform. A big screen runs the game and phones act
as dumb controllers. It is a framework many games are built on, not a single game.

Success is that a group of friends goes from "let's play something" to actually playing in
under a minute, with zero installs, and that the room reacts visibly the moment each person
joins.

Two deployment modes exist and game code is identical in both: a zero-cost **local LAN mode**
(a portable Electron host app sent to a friend) and a hosted **cloud mode** (server plus
screen over wss). Cloud mode is not yet built.

## Positioning

Jackbox-style couch multiplayer, but self-hostable, extensible, and MIT-licensed. The
combination a neighbouring product cannot truthfully copy: a game is only three parts (server
logic, screen view, controller view) while the framework owns rooms, join and leave, state
sync, input routing, reconnection, lobby, QR, and transport, and the same game binary runs on
a friend's laptop over LAN with no account and no internet.

## Operating Context

- **The screen** is a real TV, typically driven over HDMI from a laptop or from the Electron
  host app. Viewing distance is roughly three metres. It is a ten-foot UI, read by the whole
  room at once, never by one person leaning in.
- **The controller** is whatever phone the player already has, held in one hand, glanced at
  rather than read, because eyes belong on the TV. Controls need thumb-sized, no-look targets.
- Joining is by QR code or a four-letter room code shown on the TV.
- Local LAN mode has **no internet at all**: no CDN fonts, no CDN icons, no remote assets.
- The room is loud and social. Players talk over the game; the game is the centrepiece of the
  room, not a focused solo task.

## Capabilities and Constraints

- **The screen app must adapt to any display size**, not one fixed canvas. Confirmed
  2026-08-02, reversing the earlier decision. The current `TVStage` renders a hard-coded
  1920x1080 stage scaled to fit, which letterboxes on anything that is not 16:9; the new look
  is expected to lay out fluidly instead. Type still targets the ten-foot viewing distance, so
  scale is driven by viewport, not by fixed pixel values.
- **Games are fluid by default too.** Most planned games are quiz-shaped and lay out fluidly
  without effort. A game that genuinely needs a fixed frame (real 3D, a racer) may declare an
  **aspect ratio** and the framework letterboxes it to that ratio. It may never declare a pixel
  size. Confirmed 2026-08-02; not yet expressed in `GameDefinition.meta`.
- Controller is web and PWA only. Native is deferred and would be a Capacitor wrap of the same
  code, never a separate codebase.
- **The phone is a dumb controller; the screen renders everything.** Input pays one-way
  latency only, never a round trip.
- Per-game authority: turn-based games are server-authoritative; real-time games declare
  `tickRateHz` and run a screen-authoritative 60fps loop.
- Input is expressed as **logical actions** (`jump`, `select`), never raw keys. Physical inputs
  (touch widgets, keyboard, gamepad) map onto actions.
- Transport is a swappable interface. WebSocket is the default implementation; WebRTC is a
  future one behind the same interface. No app or game code imports a concrete transport.
- Every player holds a **reconnect token** so a WiFi blip reclaims their slot.
- No fixed player cap. Each game declares `meta.maxPlayers`; the framework supplies a default.
- **Players have no colour.** Identity is carried entirely by the player's **character**, never by
  a hue. Colour ran out around six people and the room supports twelve-plus, so it was removed
  from identity rather than demoted. Confirmed 2026-08-03; supersedes both the original
  six-fixed-colours model and the interim "colour as support" wording.
  This governs **platform chrome**: lobby, in-game header, avatar picker, end-of-round. A game
  may still colour its own pieces (Tic-Tac-Toe needs to tell X from O), but that is the game's
  choice, not a player property the platform presents.
- **Character artwork is drawn from three licensed sets**, chosen 2026-08-03: game-icons.net
  silhouettes (CC BY 3.0), Microsoft Fluent Emoji flat variant (MIT), and Twemoji (CC BY 4.0).
  Each set's attribution ships in the phone menu's About screen.
- The screen app holds a **Wake Lock** so the display never sleeps mid-game.
- Games declaring `needs.motion` require a secure context (HTTPS) on LAN. The local-cert
  strategy is an **undecided** product fact.
- Music and audio source is **Deezer, never Spotify**. Spotify's Developer Policy bans games
  and nulls `preview_url` for new apps.
- Room modes today: `lobby`, `configuring`, `in-game`. Games are chosen from an in-lobby
  picker driven by the host's phone; the old `HUBBUB_GAME` env switch is retired.
- **Two ways to reach a game, confirmed 2026-08-02.** The host browses the catalogue *on the
  TV* using their phone as a remote, so the screen is the thing everyone is reading. Separately,
  **any player can browse the catalogue on their own phone and throw a game up as a suggestion**;
  suggestions surface on the TV and the host picks from them. The room therefore votes with its
  phones while the TV stays the shared view. Suggestions exist in the protocol already
  (`Suggestion`, the ROOM PICK badge); the phone-side browsing half is not built yet.

## Brand Commitments

- The name **hubbub** is a working codename. The real public name is undecided; treat the
  wordmark as provisional rather than fixed identity.
- License is **MIT**. The copyright holder line in `LICENSE` is the placeholder `Joe`, to be
  replaced before public release.
- Icons are **Phosphor**, bundled into the apps, never CDN-loaded.
- A shared `@hubbub/ui` package already carries the incumbent tokens, fonts, and components
  (`TVStage`, `GameTopBar`, `KeyArt`, `Avatar`, `PlayerPill`, `GlowButton`, `EndOfRoundScreen`).
  It is the incumbent visual authority.
- A committed app icon set and controller web manifest already ship.

## Evidence on Hand

- Design spec: `docs/superpowers/specs/2026-06-24-hubbub-party-game-framework-design.md`.
- Handoff and current state: `docs/PROJECT_STATE_AND_NEXT_STEPS.md`.
- A prior visual research pass with twelve reference screenshots and per-surface
  recommendations: `.for_bepy/design-direction.md` and `.for_bepy/design-refs/`.
- Working games: `packages/games/tictactoe`, `packages/games/ultimate-tictactoe`. Additional
  games live in sibling repos linked by junction.
- No real user testing, no telemetry, no public users, no press, no testimonials exist.
  Nothing about adoption, player counts, or reception may be claimed.

## Product Principles

1. **Zero friction to join.** Scan or type four letters and you are in. Any step that adds an
   install, an account, or a decision before play is a defect.
2. **The room reacts.** Joining, and **who won**, must be visible to everyone at once. A player
   appearing on the TV is the single strongest signal that the thing is alive. Exhaustive detail
   (every player's score, your own placement) may live on the phone instead - the room shares the
   outcome, each player reads their own.
3. **The TV performs; the phone reads.** All spectacle lives on the screen. The controller is
   glanceable and thumb-first, never a shrunken mirror of the TV - but where the TV is celebrating
   and the phone would otherwise be idle, the phone may carry the reference detail the TV
   deliberately drops.
4. **Legible from three metres, drunk.** If a label, state, or affordance cannot be read
   across the room at a glance, it is wrong regardless of how it looks in a screenshot.
5. **The framework absorbs the complexity.** A game author writes three parts. Anything a
   game has to reimplement belongs in the framework instead.

## Accessibility & Inclusion

No formal standard has been established. Two product-specific needs are confirmed by the
operating context: contrast and type must survive a three-metre viewing distance on a TV of
unknown calibration, and **player identity must never be carried by colour alone**. The second
is settled by product decision rather than as an accessibility accommodation, since colour does
not scale to twelve-plus players; avatar and name carry identity, colour supports it.
