# Hubbub Release Pipeline and Phase G Decisions

> Status: Decision record, 2026-08-11. Extends
> `2026-08-05-hubbub-cloud-hosting-and-game-distribution-design.md` and
> `2026-08-08-hubbub-phase-g-sandbox-security-analysis.md`. The sandbox mechanism itself is
> settled in the 2026-08-08 record and is NOT re-opened here; read it first.
>
> Scope: how a game gets from a git push to a player's screen. Branch model, release channels,
> bundle storage, bundle contents, CI/CD across the repo estate.

---

## 1. Why this exists

Joe asked for CI/CD: a build on push, a staging URL, and "when I push to staging it uploads to
our platform for the staging section." Investigation established that **this ask and Phase G are
the same problem**. A game is currently a build-time dependency of the platform
(`packages/games-manifest/package.json` resolves each game via `link:../../../hubbub-game-<id>`),
so there is no artifact to upload and no upload target. The pipeline cannot exist before Phase G's
hash-pinned bundle does.

Phase status verified against code on 2026-08-11: **A, B, C, E, F, H, J are shipped. D is half
done** (server side complete, screen reattach missing, tracked as todo 33, explicitly rated
non-blocking). **G and I remain**, and I is meant to ship inside G.

---

## 2. Decisions

All decided by Joe on 2026-08-11 unless marked otherwise. Do not re-litigate.

### 2.1 Repo estate and branches

- **`main` everywhere.** `hubbub` was renamed from `master`; the four game repos were already on
  `main`.
- **Three branches per repo: `main` (production), `staging` (staging build), `develop`.**
- **`develop` runs nothing.** No checks, no deploy. It is Joe's working branch.
- **`hubbub` is PUBLIC** (`github.com/SirBepy/hubbub`, created 2026-08-11). The four game repos
  stay private. Pre-publish scan found no secrets across all 134 commits.
- **Production deploys automatically** on push to `main`. No approval gate; Joe is the only
  person merging. `main` carries a ruleset blocking force-push and deletion.

### 2.2 Release channels

Follows the pattern every comparable platform converged on (Steam branches, npm dist-tags, VS Code
pre-release, Chrome Web Store, Figma, Roblox): an **immutable artifact**, plus a **channel that is
a pointer with access control**. None of them model a channel as a separate deploy or codebase.

- Two channels: `staging` and `public`.
- Each is a **version-controlled catalogue file in the platform repo**: `catalogue/staging.json`
  and `catalogue/public.json`. Git is the audit trail, a PR diff is the review, and revocation is
  a revert.
- **The platform does NOT read those files at runtime. Merging the PR syncs the catalogue into
  KV, and the platform reads KV.** Caught 2026-08-11: a file in the repo only takes effect on
  deploy, so a git-only catalogue would mean **publishing a game redeploys the platform** - the
  exact thing Joe ruled out. Git keeps the approval record and the history; KV makes it live.
  This is also why KV is in the stack regardless of what stores the bundles (2.4).
- **The approval gate of Phase I is merging that PR.** No new infrastructure. This is the F-Droid
  `fdroiddata` pattern and it survives the transition to third-party authors unchanged: only who
  may open the PR changes, not the mechanism.
- Channels never share storage. Separate catalogues, separate origins (2.5).

### 2.3 Release identity is the commit, not the hash

**Correction to the 2026-08-05 design**, which implied the content hash names a release.

JS bundlers are not byte-reproducible: module ordering, injected debug IDs and timestamps mean
rebuilding an unchanged commit mints a different hash. Confirmed against open issues in webpack,
Next.js and Sentry's esbuild plugin. If the hash is the identity, a rebuild produces an artifact
no approval record points at.

- **Identity: the game repo's commit SHA** (plus a semver in the game's manifest entry for
  humans).
- **The content hash is an integrity attribute of that release, not its name.**
- Storage stays content-addressed exactly as the 2026-08-08 record requires (its section 2.7).
  The two are compatible: the key is derived from the bytes, the catalogue entry is keyed by
  commit.
- **A catalogue entry stores the storage KEY, never an absolute URL.** The original design's
  `entryUrl` field is replaced by `{ id, version, commit, contentHash }`, and the shell derives
  the fetch URL by joining its configured sandbox origin with the key. Decided 2026-08-11 so that
  changing origins - moving to a custom domain, renaming a Worker, standing up a new staging
  environment - is a config change plus redeploy, and never a rewrite of already-approved
  catalogue entries. Bundles are origin-agnostic by construction, so nothing needs rebuilding or
  re-approving. **This is what makes the custom-domain decision safely deferrable.**

### 2.4 Bundle storage: Workers KV

**Revised the same day. R2 was chosen first and then rejected on cost-safety grounds; this
section records both, because the reasoning matters more than the answer.**

**The hard constraint is no payment method on the account.** Joe, 2026-08-11: "im scared about
the card... what if we fuck something up, make something like a infinite loop and i get a huge
fine... i prefer knowing im not paying for anything and im not in danger."

This is not squeamishness, it is a real architectural property. **With no payment method, the
free plan fails closed:** exceed a limit and requests start failing. Adding any subscription
flips that to "keeps serving, sends an invoice", and a runaway CI loop is exactly the shape that
produces a surprise bill. Preserving fail-closed outranks architectural preference.

- **Workers KV**, included in the Workers free plan with **no separate subscription and no card**.
- Key: `games/<id>/<sha256-of-bytes>.js`, hash computed **server-side at ingest**, never taken
  from author metadata (2026-08-08 record, section 2.7: content-addressed, not label-based).
- Publishing is **one KV write. No Worker deploy.** Per-game rollback works by repointing the
  catalogue. No git growth, no shared blast radius, no concurrent-publish race.
- Free limits against this workload: 1 GB storage (~3,000 bundles at 300 kB), 1,000 writes/day
  (a publish is one write), 100k reads/day, 25 MiB max value against ~300 kB bundles.
- **The eventual-consistency objection does not apply here.** KV takes up to 60s to propagate
  globally, which is why this option was first rated 4/10. That was wrong for this flow: CI
  writes the bundle, opens a PR, and a **human merges it**. The gap is minutes to days, so the
  60s window has always closed before anything can fetch the object.
- Rejected: **R2 (best pure architecture, but requires a card on file).** The dashboard
  screenshot on 2026-08-11 settled the long-unverified question: the R2 page is a subscription
  signup reading "Add R2 subscription to my account", billed to "your payment method on file",
  with "Cloudflare may preauthorize your payment method during the period to validate funds".
  Due Monthly is $0.00 with no floor fee, so the only exposure is overage - but the exposure is
  non-zero, which is what disqualifies it.
- Rejected: **static assets in the platform repo (5/10)** - bytes land in git forever and cannot
  be reclaimed without a history rewrite; every game becomes one deployment unit, so a bad deploy
  takes down all games and rollback becomes all-or-nothing across games; concurrent publishes
  race to deploy the same Worker; and the approval PR shows a minified blob nobody can review.

### 2.5 Four Workers

| Worker | Origin | Role |
|---|---|---|
| `hubbub` | `hubbub.tabsxlabs.workers.dev` | production shell, relay, DOs |
| `hubbub-games` | `hubbub-games.tabsxlabs.workers.dev` | production sandbox origin |
| `hubbub-staging` | `hubbub-staging.tabsxlabs.workers.dev` | staging shell, its own DOs |
| `hubbub-games-staging` | `hubbub-games-staging.tabsxlabs.workers.dev` | staging sandbox origin |

- Free plan allows 100 Workers per account; this uses 4. Each gets Cloudflare-issued TLS on its
  own `workers.dev` subdomain, so the second origin costs no domain purchase - correcting the
  2026-08-05 design's `games.hubbub.app` framing.
- Staging gets its own Durable Objects, so a staging room can never touch a live party.
- Staging gets its own sandbox origin so an unapproved bundle is not merely un-listed in
  production but physically unreachable from it. "Staging and production sharing storage" was
  named the most-regretted anti-pattern in this space.
- Implemented as wrangler environments where possible, so the staging name is derived rather than
  duplicated.

### 2.6 Bundle contents: fully self-contained

Rated 8/10 on 2026-08-11.

- A game bundle inlines **everything**: React, `@hubbub/sdk`, `@hubbub/ui`, `zod`, fonts, CSS.
- No import map, no externals, no runtime contract with the platform. An approved bundle behaves
  identically in three years regardless of what the platform ships. This is what Chrome
  extensions, VS Code extensions and Figma plugins all do.
- Rejected: **React-external (5/10)** pays the full coupling cost for the smallest saving and
  still duplicates `@hubbub/ui`. Rejected: **all-shared-external (3/10)** makes `@hubbub/ui` a
  runtime-enforced public API with no build-time error, reintroducing the versioned-package
  coupling that publishing to npm was rejected for, and gutting hash pinning by making approved
  bytes behave as a function of platform state.
- Accepted cost: a CVE in React or Phosphor means rebuilding and re-approving every game. Blunted
  because this code runs sandboxed with no storage access and a locked-down CSP.
- **Never ship sourcemaps to the public catalogue.** The bundles are world-readable; the game
  repos are private. Sourcemaps would publish their source.
- **This supersedes todo 40.** That todo wants the ~295 kB of duplicated `@hubbub/ui` across
  sibling repos deduplicated. The duplication only costs anything because the platform currently
  bundles every game into its own build. Once each game is an independently-fetched bundle loaded
  only when played, the duplication stops being a platform-wide initial-chunk cost and becomes a
  per-game lazy fetch cached forever on its hash. Close todo 40 into this work rather than
  fixing it separately.

### 2.7 Retention: keep artifacts, never rebuild to revert

Joe proposed keeping no old versions and rebuilding an old commit to revert. **Rejected, rated
2/10.** Non-reproducible bundles (2.3) mean a rebuild yields bytes that were never approved and
cannot be shown equivalent to what was running. Worse, it puts a full CI build - npm availability,
a working toolchain, unshifted transitive deps - on the emergency path. Rollback must be a pointer
move, not a build. Steam, npm, VS Code and Chrome all keep artifacts and roll back by repointing.

The underlying concern (unbounded growth) is valid and gets a retention policy instead:

- Keep every version referenced by **any** catalogue, plus the **last 3 public builds per game**.
- GC the rest on a schedule.
- At the retention policy above, 50 games x 3 builds x 300 kB is about 45 MB, comfortably inside
  KV's 1 GB free storage. Retention matters more on KV than it would have on R2, since the
  ceiling is 1 GB rather than 10 GB - so the GC job is required, not optional.

### 2.8 Credentials

- **Publish uses a GitHub App**, not a PAT. Fine-grained PATs cannot be non-expiring (366 days
  hard maximum), so a PAT-based pipeline breaks silently within a year. The App mints a per-run
  token that expires in an hour, so there is nothing to rotate.
- **The App's private key lives ONLY in `hubbub` and is never copied into a game repo.** Decided
  2026-08-11 after Joe asked how third-party games would work. The original write-up had each
  game repo holding the key so its CI could write into the platform; that is first-party-only by
  construction, because handing the key to an outside author grants write access to the platform
  repo. Installed on this account only.
- **Checks need no token at all.** A private repo can check out a public sibling unauthenticated,
  which is what made publishing `hubbub` worth doing.
- **The platform job must NOT run the games' tests.** That is the one direction requiring a
  credential (public repo reading private siblings). This amends todo 46 step 5.
- **CORRECTION, 2026-08-11.** The sentence above originally continued "...and dropping it removes
  tokens from the checks pipeline entirely." That was wrong, and it was wrong because it assumed
  the platform could verify itself alone. Measured on a clean clone with no sibling game repos:
  `pnpm install` passes, but **`pnpm typecheck` fails at `@hubbub/games`, `pnpm build` fails at
  `@hubbub/server`, and 8 of 29 test files fail to load** (the 141 tests that do run all pass -
  the failures are import errors, not breakage). `packages/games-manifest` imports every game
  statically, so the platform depends on private repos at build time whether or not it runs their
  tests.
  **Resolution (Joe, 2026-08-11): decouple the manifest rather than hand CI a credential.** That
  is Phase G work pulled earlier rather than new work, so the alternative would have been built
  and then deleted. Tracked as its own todo. Until it lands, the platform has no checks workflow;
  the game repos' workflows are unaffected and ship now, because they only need themselves plus
  the **public** hubbub checkout, which requires no token.
- Cloudflare deploys need an API token with Workers deploy + **Workers KV write** scope, stored
  as a repo secret. **No R2 scope** - see 2.4.

### 2.9 CI checks

Joe's call, 2026-08-11: **check workflows everywhere**, per todo 46.

- Shared mechanics live in a **composite action in public `hubbub`**
  (`.github/actions/setup`), used as `SirBepy/hubbub/.github/actions/setup@main`. Each game repo
  keeps its own short workflow.
- Composite action rather than a reusable workflow, because reusable-workflow access is
  asymmetric: a public repo can only call public reusable workflows, so `hubbub` could never call
  into a private game repo. A composite action sidesteps this and composes better with per-repo
  job logic that legitimately differs.
- Sibling layout on the runner: check both repos out **under** the workspace as siblings of each
  other (`actions/checkout` refuses paths above `$GITHUB_WORKSPACE`), so a game's
  `file:../hubbub/packages/sdk` resolves exactly as it does locally.
- `pnpm/action-setup` must run **before** `actions/setup-node` with `cache: pnpm`, or the cache
  step cannot find pnpm on PATH.
- Concurrency capped at 5 per the global process-hygiene rule.
- Public repos get unlimited Actions minutes. The three private game repos share 2,000 Linux
  minutes/month and will not come close.

---

## 3. The pipeline, end to end

**Game repo, push to `develop`:** nothing.

**Direction: PULL, not push.** Decided 2026-08-11. A game repo never writes into `hubbub`. It
publishes to its own GitHub Release; the platform fetches. This keeps the App key in one place
(2.8) and means the first-party and third-party paths are the same mechanism, so nothing gets
rebuilt when an outside game appears.

**Game repo, push to `staging`:**
1. Checks: sibling-checkout `hubbub`, `pnpm install`, typecheck, test.
2. Build the self-contained ESM bundle.
3. Publish it as a **GitHub Release asset in the game's own repo**.
4. The platform is notified (webhook into the Worker), fetches the asset, **computes sha256
   itself**, and writes KV at `games/<id>/<sha256>.js`. The hash is never taken from the author.
5. Platform opens/updates a PR adding the entry to `catalogue/staging.json`, keyed by commit SHA.
   Auto-mergeable: this is pre-approval, staging-only.
6. Merge syncs the staging catalogue into KV; the staging platform serves it.

**Game repo, push to `main`:** same, but the PR targets `catalogue/public.json` and **is not
auto-merged**. Merging it is the approval gate.

**Third-party submission** (not built yet, but the flow the above must not preclude):
1. Author publishes a Release in their own repo and opens a **fork PR** adding a catalogue entry.
   They receive no credential from Joe at any point.
2. A validation job posts a bot comment: author, source repo, release, platform-computed sha256,
   bundle size, automated check results.
3. The submission auto-lands in **staging only**, so Joe plays it at the staging URL before
   deciding. Unapproved code never reaches production to be evaluated.
4. Approve = merge. Reject = close the PR; nothing was ever in production and GC reclaims the
   staging entry. Revoke later = revert the catalogue commit.

**HARD CONSTRAINT on that validation job: it must never check out and execute the fork's code
with a write-scoped token.** That is the `pull_request_target` footgun and it is the most
exploited mistake in exactly this scenario. The job reads the JSON, downloads the asset, hashes
and measures it. It does not run it. The only place a submitted bundle ever executes is inside
the Phase G sandbox iframe.

**Platform repo, push to `staging` / `main`:** checks, then deploy the corresponding shell and
sandbox Workers.

**Rollback:** revert the catalogue entry. No rebuild.

---

## 4. What every game repo gains

Games currently ship raw TypeScript (`main: ./src/index.ts`) and are bundled by the platform's
Vite. There is no bundler in `hubbub-game-template` - only `tsconfig.json` and
`vitest.config.ts`. Phase G requires each game to build its own bundle.

- A bundler config (Vite library mode or esbuild) producing one self-contained ESM file.
- A workflow calling the shared composite action.
- Both land in `hubbub-game-template` first, so new games inherit them, then are backported to
  `tap-race`, `music-guesser` and `split-opinions`.

---

## 5. Owed by Joe before implementation

1. **Mint a Cloudflare API token** with Workers Scripts edit + Workers KV Storage edit + Account
   Settings read. The account's only existing token is "Workers AI" with no permissions, which is
   why the 2026-08-11 `wrangler r2 bucket list` probe failed on auth rather than on R2 status.
2. **Create the GitHub App** for publishing (2.8).

`wrangler login` cannot run from Claude's shell, and dashboard actions are Joe's either way.

**Settled 2026-08-11 by dashboard screenshots, no longer owed:**

- **R2 requires a card.** See 2.4; the decision moved to KV and does not reopen.
- **Custom domains are NOT paid-gated.** The `hubbub` Worker page offers "Connect a custom
  domain" as a next step with no upgrade prompt, and shows `Custom domains —` empty. A domain
  therefore remains a live option on the free plan; only availability and price are unknown, and
  the name itself is still open (Joe leans to keeping `hubbub`).

---

## 5a. Lessons taken from AirConsole

Researched 2026-08-11. AirConsole is the closest commercial analog (TV screen, phone controllers,
third-party game authors). Two findings changed this design; the rest confirmed it.

**Confirmed, do not revisit:**

- **Per-game self-contained bundles are what AirConsole does too.** Every game is a standalone
  payload with no shared runtime and no import map; their only lever against bloat is a size cap
  enforced at review. So 2.6 is validated, not a scaling mistake.
- **They keep old versions and roll back by repointing**, never by rebuilding. More evidence for
  2.7.
- **They have no content hashing or integrity pinning of any kind**, and their docs never mention
  `sandbox`, CSP or cross-origin isolation (absence confirmed across seven fetched pages). Their
  storage API states outright that it is "public, not secure, and anyone can request and tamper
  with it" - they protect the platform by exposing very little rather than by isolating strongly.
  Our posture is stronger on both axes; do not weaken it on the grounds that a bigger platform
  ships less.

**Adopted, and both are gaps in this design:**

1. **Enforce budgets, don't just report them.** AirConsole's review applies concrete numbers
   (50MB gzipped initial load, 30fps browser / 25fps Android TV, <=512MB RAM, works to 320x480,
   correct mid-game join/leave). The validation job in section 3 must **fail** on a budget, not
   just print a number in the bot comment. Pick a bundle-size ceiling far tighter than theirs -
   these are lazy-fetched party games, not 50MB downloads.

   **Resolved, 2026-08-21 (todo 52): 512 KiB raw bytes per game, hard failure at ingest, not
   gzip and not a warning.** KV stores and serves raw bytes; gzip is a transport negotiation, so
   the check runs on what is actually stored. Avatars stay inside the bundle for now: §2.6
   already rejected externalizing `@hubbub/ui` as a runtime-loaded module (all-shared-external,
   3/10, guts hash pinning) - but that rejection covers CODE, not avatar art as opaque bridge
   data, so the only live alternative is widening the Phase G bridge payload past `PlayerInfo`.
   The 2026-08-08 record's S12 names "passing full `Player` because the view wants an avatar" as
   the literal scope-creep pattern it exists to resist, so that route is not a lever to pull as a
   side effect of a budget number.

   Basis (measured 2026-08-21, `pnpm build`, one `dist/bundle.js` per game,
   `cssCodeSplit: false`):

   | game | raw | gzip |
   |---|---|---|
   | template (no `@hubbub/ui`) | 158.92 kB | 35.78 kB |
   | split-opinions (no `@hubbub/ui` import) | 253.57 kB | 76.76 kB |
   | tap-race | 312.52 kB | 96.51 kB |
   | music-guesser | 428.27 kB | 170.46 kB |

   `@hubbub/ui`'s avatar art (fluent-emoji + game-icons + twemoji, loaded unconditionally by
   `packages/ui/src/avatars/resolve.ts:54-56`) is a fixed 147,075 raw bytes, present in tap-race
   and music-guesser, absent from split-opinions and template. It is a per-game rendering
   choice, not a platform requirement: split-opinions renders `player.emoji` as raw text
   (`screen.tsx:88`) and pays zero avatar bytes today, proving the tax is already avoidable
   without touching the bridge or S12.

   512 KiB = today's largest avatar-free footprint (music-guesser, ~281 kB) + the avatar tax
   (~147 kB) + roughly 20% headroom, rounded to a clean power of two. That leaves ~218 kB of
   headroom above music-guesser's own game-specific code (~122 kB today) - a game has to add
   nearly as much bespoke code as music-guesser's entire logic to trip this, not just a few kB
   over budget.

   Exit condition: drops to 384 KiB (avatar-free footprint + headroom, no tax) once no shipping
   game bundle carries the avatar art payload - i.e. once every game follows split-opinions's
   pattern or the tax itself leaves `packages/ui`. Todo 45's per-game visual-identity doctrine
   already points every future game that direction; re-set explicitly when it is true for the
   games actually shipping, not on the day one game happens to hit zero avatar bytes. Settles
   todo 52.

2. **The local dev loop must be able to run a game inside the sandbox.** This is the real hole.
   The 2026-08-05 design's "Local dev loop" resolves games as workspace packages and bypasses the
   sandbox entirely, so an author develops against something structurally different from what
   ships. A game that works locally can break in the iframe: state holding a `Map`, a reducer
   touching `window`, anything that does not survive structured-clone. AirConsole's preview link
   tests the exact uploaded build; ours would not test the shipping shape at all.
   **Requirement: a sandbox-mode toggle in the dev loop** that mounts the local game through the
   real iframe + MessageChannel path. The fast no-sandbox loop stays the default for iteration;
   sandbox mode is what an author runs before publishing. This also makes Blocker #3's state
   schema testable locally instead of in production.

## 6. Not decided here

- The `stateSchema` migration question when a version bump changes the schema under an existing
  Phase D backup blob. Still open from the 2026-08-05 design.
- The approval-bypass mechanism for self-hosted operators. Decided in principle (a build-time
  flag, Joe 2026-08-06) but unimplemented.
- Concrete GC schedule and where the cleanup job runs.
- Whether the staging catalogue should auto-expire entries, given staging builds accumulate
  faster than public ones.
