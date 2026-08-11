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

### 2.4 Bundle storage: R2

Rated 8/10 against the alternatives on 2026-08-11, with Joe's explicit constraint that rebuilding
one game must not rebuild the platform.

- **R2 bucket, fronted by the sandbox Worker.** CI publishes with a single object write and **no
  Worker deploy at all**. Blast radius is one bundle; retention is one delete call.
- Key: `games/<id>/<sha256-of-bytes>.js`, the hash computed **server-side at ingest**, never
  taken from author metadata (2026-08-08 record, section 2.7: content-addressed, not
  label-based).
- Rejected: **static assets in the platform repo (5/10)** - bytes land in git forever and cannot
  be reclaimed without a history rewrite, every game becomes one deployment unit, and the
  approval PR shows a minified blob nobody can review. Rejected: **Workers KV (4/10)** - up to
  60s eventual consistency puts an intermittent failure directly in the publish path, and blob
  storage in KV is a known misuse.
- Free tier is over-provisioned for this by orders of magnitude: 10 GB storage, 10M class-B
  reads/month, zero egress, against roughly 50 objects and a few hundred fetches a day.

**UNVERIFIED, and it gates this decision:** whether enabling R2 requires a payment method on the
account even at zero spend. Cloudflare's docs do not state it; the community threads reporting it
are behind a login wall. A `wrangler r2 bucket list` probe on 2026-08-11 failed on API-token scope,
not on R2 being disabled, so it settled nothing. **Do not assert either answer.** See section 5.

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
- 10 versions x 50 games x 300 kB is about 150 MB, roughly 1.5% of the R2 free tier.

### 2.8 Credentials

- **Publish uses a GitHub App**, not a PAT. Fine-grained PATs cannot be non-expiring (366 days
  hard maximum), so a PAT-based pipeline breaks silently within a year. The App mints a per-run
  token that expires in an hour, so there is nothing to rotate. One-time setup on Joe's account,
  private key stored as a repo secret.
- **Checks need no token at all.** A private repo can check out a public sibling unauthenticated,
  which is what made publishing `hubbub` worth doing.
- **The platform job must NOT run the games' tests.** That is the one direction requiring a
  credential (public repo reading private siblings), and dropping it removes tokens from the
  checks pipeline entirely. This amends todo 46 step 5.
- Cloudflare deploys need an API token with Workers deploy + **R2 write** scope, stored as a
  repo secret.

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

**Game repo, push to `staging`:**
1. Checks: sibling-checkout `hubbub`, `pnpm install`, typecheck, test.
2. Build the self-contained ESM bundle.
3. Upload to R2. The sandbox Worker computes sha256 at ingest and stores at
   `games/<id>/<sha256>.js`.
4. Open/update a PR against `hubbub` adding the entry to `catalogue/staging.json`, keyed by
   commit SHA, carrying the hash. Auto-mergeable: this is pre-approval.
5. Staging platform serves it.

**Game repo, push to `main`:** same, but the PR targets `catalogue/public.json` and **is not
auto-merged**. Merging it is the approval gate.

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

1. **Open the R2 tab on the `tabsxlabs@gmail.com` Cloudflare dashboard** and report whether it
   demands a payment method. This gates 2.4. If it does, the decision reopens rather than
   silently falling back.
2. **Mint a Cloudflare API token** with Workers deploy + R2 write scope. Needed regardless; the
   current token lacks R2 scope, which is what the 2026-08-11 probe actually proved.
3. **Create the GitHub App** for publishing (2.8).

`wrangler login` cannot run from Claude's shell, and dashboard actions are Joe's either way.

---

## 6. Not decided here

- The `stateSchema` migration question when a version bump changes the schema under an existing
  Phase D backup blob. Still open from the 2026-08-05 design.
- The approval-bypass mechanism for self-hosted operators. Decided in principle (a build-time
  flag, Joe 2026-08-06) but unimplemented.
- Concrete GC schedule and where the cleanup job runs.
- Whether the staging catalogue should auto-expire entries, given staging builds accumulate
  faster than public ones.
