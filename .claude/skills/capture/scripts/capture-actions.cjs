const fs = require('fs');
const path = require('path');
const os = require('os');

// Playwright isn't a repo dependency (this script is dev-only tooling); fall back to an
// npx-cache copy before giving up, since `npx playwright` leaves one behind per version.
function resolvePlaywright() {
  try {
    return require('playwright');
  } catch (e) {}
  const npxRoot = process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx')
    : path.join(os.homedir(), '.npm', '_npx');
  try {
    for (const hash of fs.readdirSync(npxRoot)) {
      const candidate = path.join(npxRoot, hash, 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
  } catch (e) {}
  console.error('Playwright not found. Install it with `npm install playwright` (or `npx playwright@latest --version` to seed the npx cache), then retry.');
  process.exit(1);
}

// Mirrored from packages/protocol/src/tokens.ts / constants.ts (raw TS, not requirable from plain CJS); keep both in sync.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 4;
const DEFAULT_BASE_URL = 'http://localhost:5175';

function attachConsole(page, label, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      bucket.push(`[${label}] ${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => bucket.push(`[${label}] pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    bucket.push(`[${label}] requestfailed: ${req.url()} ${req.failure() ? req.failure().errorText : ''}`);
  });
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(400);
}

async function shot(page, outPath) {
  await settle(page);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
  console.log('Saved:', outPath);
}

// apps/web serves the TV hero and the phone entry from one origin; only apps/screen (5173)
// and apps/controller (5174) standalone still lack the [data-measure] hook, so fall back
// to the old whole-body text scan for that legacy pair.
async function getRoomCode(page) {
  const re = new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
  try {
    const locator = page.locator('[data-measure="room-code"]');
    await locator.waitFor({ timeout: 18000 });
    const text = (await locator.textContent()).trim();
    if (re.test(text)) return text;
  } catch (e) {}
  for (let i = 0; i < 60; i++) {
    const code = await page.evaluate((pattern) => {
      const rx = new RegExp(pattern);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        if (rx.test(t)) return t;
      }
      return null;
    }, re.source);
    if (code) return code;
    await page.waitForTimeout(300);
  }
  throw new Error('Room code never appeared on TV screen');
}

async function firstEnabledEmoji(page) {
  const buttons = page.locator('button[title]');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i);
    if (await b.isEnabled()) return b;
  }
  throw new Error('No enabled avatar button found');
}

// apps/web's controller role shows a "Continue as guest" welcome screen before the identity
// form; apps/controller standalone (legacy 5174) skips straight to it. Detect rather than
// branch on mode, so this stays the one join-flow implementation for both targets.
async function doIdentity(page, name, emoji, shotOut) {
  const welcomeBtn = page.getByRole('button', { name: 'Continue as guest' });
  const hasWelcome = await welcomeBtn.waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
  if (hasWelcome) await welcomeBtn.click();

  await page.getByPlaceholder('Your name').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Your name').fill(name);
  if (emoji) {
    await page.getByRole('button', { name: emoji, exact: true }).click();
  } else {
    await (await firstEnabledEmoji(page)).click();
  }
  if (shotOut) await shot(page, shotOut);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

async function joinRoom(page, code) {
  await page.getByPlaceholder('CODE').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('CODE').fill(code);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await page.getByRole('button', { name: 'Search games' }).waitFor({ timeout: 15000 });
}

// The one deadline loop in this file. The predicate's truthy value is what the caller gets back,
// so a poll can carry a phase string as easily as a boolean; `required: false` turns a timeout
// into a quiet null instead of a throw.
async function pollUntil(page, predicate, opts) {
  const intervalMs = opts.intervalMs || 250;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const hit = await predicate();
    if (hit) return hit;
    await page.waitForTimeout(intervalMs);
  }
  if (opts.required === false) return null;
  throw new Error(opts.errorMsg);
}

// Neither room mode has a DOM marker, so read the two screens that do: "Start" exists only on
// the config remote, "Search games" only on the lobby. The lobby unmounts a beat before the
// config remote mounts, hence the grace window - without it a settings game reads as in-game.
async function settleAfterStart(page, timeoutMs = 20000, graceMs = 3000) {
  let lobbyGoneAt = null;
  return pollUntil(page, async () => {
    if (await page.getByRole('button', { name: 'Start', exact: true }).count()) return 'configuring';
    if (!(await page.getByRole('button', { name: 'Search games' }).count())) {
      if (lobbyGoneAt === null) lobbyGoneAt = Date.now();
      if (Date.now() - lobbyGoneAt >= graceMs) return 'in-game';
    } else {
      lobbyGoneAt = null;
    }
    return null;
  }, { timeoutMs, intervalMs: 200, errorMsg: 'Room left the lobby but reached neither the config screen nor in-game' });
}

async function waitForInGame(page, timeoutMs = 20000) {
  await pollUntil(page, async () => {
    const stillConfiguring = await page.getByRole('button', { name: 'Start', exact: true }).count();
    const stillLobby = await page.getByRole('button', { name: 'Search games' }).count();
    return !stillConfiguring && !stillLobby;
  }, { timeoutMs, intervalMs: 200, errorMsg: 'Room never reached in-game: config remote or lobby still on the host phone' });
}

async function pressStart(page, opts = {}) {
  const timeout = opts.timeout || 15000;
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await start.waitFor({ timeout });
  await start.click();
  await waitForInGame(page, timeout);
}

// Lobby search -> vote -> start: tapping a game's row once votes it, tapping the same
// row again once it reappears in the voted list is what actually starts it (configStart).
// A settings-carrying game then parks on the config screen; press Start unless the caller
// wants that screen held (`pressStart: false`) to shoot it.
async function startGame(page, gameName, opts = {}) {
  await page.getByRole('button', { name: 'Search games' }).click();
  await page.getByText('All games', { exact: true }).waitFor({ timeout: 10000 });
  const voteBtn = page.locator('button', { hasText: gameName }).first();
  await voteBtn.waitFor({ timeout: 10000 });
  await voteBtn.click();
  const startBtn = page.locator('button', { hasText: gameName }).first();
  await startBtn.waitFor({ timeout: 10000 });
  await startBtn.click();
  const phase = await settleAfterStart(page, opts.timeout || 20000);
  if (phase === 'configuring' && opts.pressStart !== false) await pressStart(page, opts);
  return phase;
}

// Platform controls that a round-answering driver must never touch. Clicking "Back to lobby"
// during a reveal phase dropped the room twice and both times read as a game crash.
// Matched as a PREFIX, not a whole name: a menu row's accessible name carries its hint too
// ("Share the room QR, link, or send it"), which an anchored full-string test walks straight past.
const NEVER_CLICK = /^(back to lobby|back|rematch|leave the room|close|start|search games|share the room|pass the remote|change my avatar|how to play|about|previous|next|field up|field down)\b/i;

async function buttonName(button) {
  const aria = await button.getAttribute('aria-label');
  return ((aria || (await button.textContent()) || '').replace(/\s+/g, ' ')).trim();
}

// Answers the round only while the controller is genuinely answerable. The count guard is what
// separates a guessing window (header + the round's choices) from a reveal phase, where the only
// enabled controls are the header and "Back to lobby" - which is why "click the first enabled
// button" destroys a run. `required: false` makes a reveal phase a no-op instead of an error.
async function answerRound(page, opts = {}) {
  const minEnabled = opts.minEnabled == null ? 5 : opts.minEnabled;
  const index = opts.index || 0;
  // The identity header is the player's own name with "HOST" glued on, no separating whitespace.
  const deny = opts.playerName ? new RegExp(`^${opts.playerName}(\\s*host)?$`, 'i') : null;
  const clicked = await pollUntil(page, async () => {
    // Every drill-down sub-screen (menu, share, about, search) carries a "Back" caret and the
    // game does not, so its presence means the phone is not showing the round at all.
    if (await page.getByRole('button', { name: 'Back', exact: true }).count()) return false;
    const buttons = page.locator('button');
    const count = await buttons.count();
    const candidates = [];
    let enabled = 0;
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i);
      if (!(await b.isEnabled())) continue;
      enabled++;
      const name = await buttonName(b);
      if (NEVER_CLICK.test(name)) continue;
      if (deny && deny.test(name)) continue;
      candidates.push(b);
    }
    if (enabled >= minEnabled && candidates.length > index) {
      await candidates[index].click();
      return true;
    }
    return false;
  }, {
    timeoutMs: opts.timeout || 15000,
    intervalMs: opts.interval || 300,
    required: opts.required,
    errorMsg: `answerRound: controller never became answerable (needed >= ${minEnabled} enabled buttons)`,
  });
  return !!clicked;
}

// Polls instead of a fixed sleep: returns the moment the text appears, so a follow-up
// screenshot lands on that frame instead of an arbitrary later (or earlier) one.
async function pollUntilText(page, text, opts = {}) {
  const exact = !!opts.exact;
  const matcher = exact ? text : new RegExp(text, 'i');
  await pollUntil(page, async () => !!(await page.getByText(matcher, { exact }).count()), {
    timeoutMs: opts.timeoutMs || 15000,
    intervalMs: opts.intervalMs || 250,
    errorMsg: `pollUntilText timed out waiting for: ${text}`,
  });
}

// Composite: start a named game from the host's lobby, then poll the TV for a
// win/draw/rematch marker instead of guessing how long a round takes.
async function playToEndOfRound(hostPage, tvPage, gameName, endText, timeoutMs, opts = {}) {
  await startGame(hostPage, gameName, opts);
  await pollUntilText(tvPage, endText || 'WINS|DRAW|Rematch|PLAYS', { timeoutMs: timeoutMs || 30000 });
}

async function setThrottle(page, opts = {}) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: !!opts.offline,
    latency: opts.latency ?? 400,
    downloadThroughput: opts.downloadThroughput ?? (500 * 1024) / 8,
    uploadThroughput: opts.uploadThroughput ?? (500 * 1024) / 8,
  });
  return client;
}

async function clearThrottle(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

module.exports = {
  resolvePlaywright,
  getRoomCode,
  joinRoom,
  doIdentity,
  startGame,
  settleAfterStart,
  waitForInGame,
  pressStart,
  answerRound,
  pollUntilText,
  playToEndOfRound,
  setThrottle,
  clearThrottle,
  firstEnabledEmoji,
  settle,
  shot,
  attachConsole,
  CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  DEFAULT_BASE_URL,
};

