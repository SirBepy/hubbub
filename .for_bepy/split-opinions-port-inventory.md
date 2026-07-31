# Split Opinions — Complete Port Inventory

(Scratch file for the overnight autopilot run. Produced by a read-only scout that read
C:\Users\tecno\Desktop\Projects\split_opinions in full. The port agent should treat this as
the spec, and read the original CSVs at assets/data/ for verbatim question data.)

Standalone vanilla JS/HTML AirConsole party game. Big screen (`screen.html`) is the authoritative host holding ALL game logic; phones (`controller.html`) are thin clients. No build step, no npm, no modules.

Origin: https://github.com/SirBepy/split_opinions — live at https://sirbepy.github.io/split_opinions/.

## 0. File map

| File | Role |
|---|---|
| `screen.html` | TV host entry. Loads: constants, transport, common, cache, data, screen, screen-teams, screen-ui. |
| `controller.html` | Phone entry. Loads: constants, transport, common, controller-settings, controller-ui, controller. |
| `scripts/shared/constants.js` | `PAGES`, `GAMEMODES`, `POSITION_POINTS`, `NUM_OF_CHOICES_PER_QUESTION`, `SETTINGS`, `DEFAULT_SETTINGS`, `FILES_TO_LOOK_FOR` |
| `scripts/shared/transport.js` | `AirConsoleTransport` — only file touching the AirConsole global. |
| `scripts/shared/common.js` | DOM helpers + shared state `currentScreen`, `gamemode`, `currentQuestion`. |
| `scripts/cache.js` | localStorage: saved settings + previously-shown question ids (screen only) |
| `scripts/data.js` | Loads the 6 CSVs into `ALL_QUESTIONS_BY_CATEGORY` (screen only) |
| `scripts/screen.js` | Authoritative game loop |
| `scripts/screen-teams.js` | Team assignment + active-player rotation |
| `scripts/ui/screen-ui.js` | TV DOM rendering |
| `scripts/controller-settings.js` | Settings UI logic |
| `scripts/ui/controller-ui.js` | Phone DOM rendering |
| `scripts/controller.js` | Thin client |
| `assets/data/*.csv` | 6 question-bank CSVs |
| `assets/sounds/*.wav` | 32 sound files — completely unreferenced / dead |
| `styles/{global,screen,controller}.css` | styling |

## 1. Game rules / flow

### Screen phases (`PAGES`)
`lobby`, `questions`, `pairing`, `waitForPlayers`, `waitForNextRound`, `allSettings`, `settingsDetail`, `endOfGame`. Screen uses `lobby / questions / pairing / endOfGame`; controllers additionally use the rest.

### Flow
1. **Lobby** — Players connect (auto-assigned to smallest team on connect). Master sees Play + Settings + team toggler; non-masters see "Waiting for leader" and can still switch their own team. Start disabled with "All teams need atleast 1 player" if any active team is empty.
2. **Start** → master phone sends `{newRound:true}` → host `onNewRound()`.
3. **onNewRound**: resets round state; if NOT a reroll, `currentRound++`, updates round UI, checks `endGame()`. Picks a random gamemode from enabled ones, picks a random question, broadcasts full state, shows `questions`.
4. **Questions phase** — each phone privately picks answers (per gamemode's `allowedChoices`) and submits. Host tracks `allPlayersAnswers[device_id]`. Screen shows "Players ready: X / total". When ready == total, `onQuestionsFinished()` fires automatically.
5. **onQuestionsFinished** → `pairing`. Two branches:
   - **Aggregate gamemodes** (top_3, second_top_3, ordered): `getCalculatedAnswers()` computes the group's ranked list; screen shows a hidden table; the active player must guess which answers occupy the target rank positions.
   - **match_to_player**: broadcasts `playersToPick`; the active player must match a shown pick-list back to the player who submitted it.
6. **Pairing / guessing loop** — Active player (one per turn, rotating across teams) taps a guess → `{pair: buttonId}` → `onPairReceive()`. Host shows a 5s "Correct!/Wrong!" reveal modal, awards points on correct, then rotates the active player. Loop ends when the round is "done".
7. **Round done** → `waitForNextRound`. Master taps "Next round" → next round.
8. **Game end** — When `currentRound > numOfRounds`, `endGame()` shows the podium (`endOfGame`), broadcasts `teamPointsSorted`, resets `points={}` and `currentRound=0`. Each phone shows "You win!/lose!/played well!". Master taps "Back to Lobby".

### Round-done conditions (`isRoundDone`, aggregate modes)
Round ends if ANY:
- `pickedAllRightChoices` — all target positions guessed (`choicesToPickById.length == 0`)
- `pickedAllButRightChoices` — remaining answers == remaining targets
- `onlyOneChoiceRemains` — <=1 answer left unrevealed

For **match_to_player**, round ends when `numOfTeamsDidMatchToPlayer >= number of teams` (each team gets one guess).

### Timers
- **No countdown timers anywhere.** Questions phase waits indefinitely until all connected players submit (hard-block bug, see §9).
- Reveal modal: fixed 5000 ms. `setTimeout(..., 250)` gap between reveal and rotating active player.
- Controller "You're next!" cover animation: 7000 ms. Vibration: 100 ms pulses spaced 500 ms.

### Reroll
Any player toggles reroll → `{toggleReroll:true, isRerolling}`. When `count > numPlayers * 0.6` (strictly greater), host calls `onNewRound(true)` — reroll does NOT advance round counter, does NOT re-check endGame.

### Edge cases / topology
- **Connect**: update counter, re-broadcast screen, add player to smallest team, broadcast teams.
- **Disconnect**: if active player, reassign (with `didPlayerLeave=true` so team index isn't advanced); delete from reroll + answers maps; remove from team. If removing empties a team mid-game, `assignTeams()` fully reshuffles ALL teams (jarring; fix in port).
- **Min players**: only "every active team needs >=1 player". Default 2 teams. **Max**: none.
- **Ties**: `getSortedTeamPoints()` assigns equal `position` to equal-point teams; podium renders up to 3 slots.

## 2. Full state model

### Host-owned (authoritative)
| Variable | Type | Meaning |
|---|---|---|
| `gameSettings` | object | `{teams, numOfRounds, categories, gamemodes}`. Master-set, persisted. |
| `points` | `{teamKey:number}` | Team scores. +1 per correct guess; reset at game end. |
| `currentRound` | number | Increments per non-reroll round. |
| `allPlayersAnswers` | `{device_id: {position:buttonId}}` | Private submitted picks, e.g. `{1:"answer-3", 2:"answer-5"}`. Reset each round; deleted on disconnect. |
| `playersWishingToReroll` | `{device_id:true}` | Reroll votes. Reset each round. |
| `activePlayerId` / `activeTeamName` | | Current guesser + team. |
| `unavailableAnswers` | `buttonId[]` | Answers already revealed this pairing. |
| `choicesToPickById` | `[{id:"tableanswer-N", position}]` | Remaining correct target rows (aggregate). |
| `playerToGuessFrom` | `{team, playerId, picks}` | For match_to_player. |
| `numOfTeamsDidMatchToPlayer` | number | match_to_player progress. |
| `currentQuestion` | `{question, answers[8], category}` | |
| `teams` | `{teamName: device_id[]}` | |
| `whoIsActive` | `{lastTeamToGo, [teamName]:index}` | Rotation cursors. |
| `numberOfTimesAPlayerWent` | `{device_id:count}` | Fairness counter for who goes first in a team. |
| `prevDoneQuestions` | `string[]` | `category+question` ids shown; persisted; looped when exhausted. |

### Broadcast state (host → controllers)
`screen`, `currentQuestion`, `gameSettings`, `gamemodeKey`, `teams`, `activePlayer`, `unavailableAnswers`, `playersToPick`, `teamPointsSorted`.

### Controller-owned (per phone)
`choices` (in-progress picks pre-submit: `{positionNumber: buttonId}` or `{choice: buttonId}`), `isRerolling`, `currentTeam`, settings mirrors.

**Secrecy invariant (must survive port):** players submit privately and simultaneously, then reveal. Never render a player's private input AND the authoritative aggregate on the same device at the same time.

## 3. Gameplay data (question banks)

**Location:** `assets/data/SplitOpinions - <Category>.csv`. Categories: `Misc`, `Movies and Shows`, `Music`, `Everyday Life`, `Ideal World`, `Powers and Magic`.

**Format:** CSV, row 1 header, first column question text, remaining columns answers. Quoted fields may contain commas. Empty cells filtered out.

**Filtering rule:** question KEPT only if >=8 non-empty answers (`NUM_OF_CHOICES_PER_QUESTION` = 8). Questions with >8 answers are shuffled then sliced to 8 AT LOAD TIME. Questions with <8 silently dropped. ~40 rows total, only 24 load:

- **Everyday Life (4):** worst birthday date; rate months; house chore never again; unwanted jobs you'd do.
- **Ideal World (1):** master any skill overnight.
- **Misc (5):** kidnapper keeps a body part; which villain-person would you help; actor trust with drink (10→8); actor in friend group (10→8); bring back from the dead (19→8).
- **Movies and Shows (5):** fictional world to live in; fictional foods (9→8); saddest movie death (10→8); best movie villain; legendary weapon.
- **Music (6, all "Rank these..."):** 2000s pop (33→8); late '90s (32→8); 80's songs (31→8); 80's artists (14→8); 70's artists (8); 60's artists (8).
- **Powers and Magic (3):** supernatural ability; enchanted object; fantasy landscape.

Copy verbatim from the CSVs (they are the source of truth). Typos exist in source ("mutiple", "thse", "Snooby Snacks", "Steven Irwin") — fine to fix spelling in port. Song titles are text-only; the game plays NO audio.

## 4. Scoring rules (exact)

### Position → points (`POSITION_POINTS`)
`1→21, 2→15, 3→10, 4→7, 5→5, 6→3, 7→2, 8→1`

### Aggregate computation (`getCalculatedAnswers`)
For each player's `{position: buttonId}`, add `POSITION_POINTS[position]` to that answer's total, recording `{playerId, position}`. Then:
1. Build `[{buttonId, points, players}]`; sort each answer's players by ascending position.
2. Sort answers by descending points.
3. Assign rank 1..N with tie handling (equal points share rank, else increment).
4. Unpicked answers get points 0, position 8.
5. Answers whose rank is in `gamemode.choicesToPick` become the target rows (`choicesToPickById`).

### Team score
**+1 point per correct guess** to the active team. Position values only shape the ranking, not the award. Wrong guesses award nothing.

### match_to_player
Correct if guessed player's id equals target OR their submitted answers deep-equal the target picks (handles identical picks). Correct → +1 active team.

### Final standings
Sort teams by descending points; ties share position. 1-2-3 podium.

## 5. Controller UI per phase

- **lobby**: Master: Play + team toggler + Settings. Non-master: "Waiting for leader" + own team switch. Team indicator bar (team color) + "Show my Team" overlay + Reroll button (visible on questions/waitForPlayers only).
- **allSettings/settingsDetail**: Categories, Gamemodes, Number of rounds (2/3/4/5/6/Infinite), Teams (min 2). Multi-select toggles; save validates.
- **questions**: question text + 8 answer buttons. Tap toggles selection with number badge (1..allowedChoices). Submit shows "N choices left" until exact, then Submit → `{answers}` → waitForPlayers.
- **pairing**: only active player interactive; others dimmed "Waiting for current player". Active picks ONE → submit. Two layouts: answer buttons (aggregate, hidden ones removed) or player-name buttons (match_to_player). Before becoming active: 7s "You're next!" full-screen cover + vibration (3x own turn, 2x teammate's).
- **waitForNextRound**: master "Next round", others waiting.
- **endOfGame**: "You win!/lose!/played well!"; master "Back to Lobby".

## 6. Screen UI per phase

- **Persistent**: round indicator "Round: X / Y"; scoreboard bottom-left (per-team card, team color, avatars + names + score).
- **lobby**: title, settings summary table, decorative Play.
- **questions**: "Players ready: X / total" + fade-in "Players wanting new question: X / total".
- **pairing**: big ranked table: rank #, hidden Points column, hidden Answer column, per-answer player avatars with position badges; target rows highlighted; revealed rows tinted guessing team's color. match_to_player uses a picks-table. Round done: reveal everything + "Waiting on master".
- **Reveal modal (keep!)**: staggered ~5s suspense: "<nick> chose" → "<Option>" → "and that is…" → "Correct!/Wrong!" (green/red) → "It was <right>" on wrong. blur backdrop.
- **endOfGame**: podium heights 200/150/100, center/left/right, team colors.

## 7. Old networking (replaced by hubbub protocol)

Phone → host messages that must survive semantically:
`{newRound:true}` start/next; `{answers:{position:buttonId}}` submit; `{pair:buttonId}` guess; `{toggleReroll,isRerolling}`; `{switchTeams:teamName}`; `{gameSettings}}` master settings; `{goBackHome:true}`.
`buttonId` formats: `answer-<1..8>`, `tableanswer-<1..8>`, `playersanswer-<playerId>`.
Host broadcast keys: screen, currentQuestion, gameSettings, gamemodeKey, teams, activePlayer, unavailableAnswers, playersToPick, teamPointsSorted.

## 8. Audio / assets

- 32 .wav in assets/sounds/ are DEAD (never referenced). Names: pop1-6, Some nice click, settings(x2), newquestion1-9, lastquestion1-2, correct1-12, whoosh. Optional port opportunity; any *music* must be Deezer, never Spotify (game currently plays no audio at all).
- Avatars came from AirConsole CDN → hubbub equivalent is player emoji/color identity.
- Fonts: Google Fonts CDN Ubuntu → hubbub is offline-LAN, use system-ui (no CDNs).
- Colors: bg `#3d0084`, primary `#e249aa`, secondary `#6e27c0`; teams red `#c23232`, blue `#384baa`, green `#1ea054`, "cyan" `#48bcc4` (value string "yellow" — label/value mismatch bug); success `#23df71`, fail `#e43838`.

## 9. Rough edges to fix in port

1. `toggleQuestionAnswer` deselect bug (controller.js:170): badge renumbering desync/null deref. Reimplement cleanly.
2. "Cyan" team `value:"yellow"` mismatch — name teams consistently.
3. No guard when enabled categories yield 0 loadable questions → undefined question. Guard + fallback.
4. Questions phase hard-blocks on an AFK player — no timer/skip. Add one (or host force-advance).
5. `assignTeams` fractional slicing → uneven splits. Use round-robin.
6. Mid-game full reshuffle when a team empties — replace with minimal rebalance or leave team empty till round end.
7. Reroll threshold strict `> 60%` of all controllers incl. AFK.
8. `onPairReceive` throws on non-active/teamless pair (race on disconnect could crash host). Ignore gracefully.
9. Dead commented gamemode `guess_enemy_list`.
10. Timing coupling: 5000ms modal + 250ms rotation + 7000ms controller cover hardcoded.
11. Ordered modes subtlety: `choicesToPick` up to length 7 but `allowedChoices:5`; `getFirstOrderedFreePosition` correctness check = must pick the first still-free target position. Port carefully.
12. Load-time shuffle-and-slice of >8-answer questions: decide policy (suggest: shuffle-and-slice per ROUND, not per load, so variety improves).
13. Dead CSS + dead sounds — don't port.
14. Settings master-gating vs local UI divergence.

### Gamemodes reference
- `top_3` "Pick top 3": allowedChoices 3, targets [1,2,3]
- `second_top_3` "Pick 2 - 4": allowedChoices 4, targets [2,3,4]
- `bottom_to_top` "Ordered pick from bottom to top": allowedChoices 5, targets [8,7,6,5,4,3,2], ordered
- `top_to_bottom` "Ordered pick from top to bottom": allowedChoices 5, targets [1,2,3,4,5,6,7], ordered
- `who_does_this_belong_to` "Guess who the list belongs to": allowedChoices 3, match_to_player, usesOponentsAnswers

### Settings & defaults
`categories` (multi, canSayAll), `gamemodes` (multi, canSayAll), `numOfRounds` (single: 2/3/4/5/6/Infinite=9999), `teams` (min 2, red/blue/green/cyan). DEFAULT: teams [red,blue], numOfRounds 3, all categories, all gamemodes.
