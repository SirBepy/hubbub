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
const { chromium } = resolvePlaywright();

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

// Neither room mode has a DOM marker, so read the two screens that do: "Start" exists only on
// the config remote, "Search games" only on the lobby. The lobby unmounts a beat before the
// config remote mounts, hence the grace window - without it a settings game reads as in-game.
async function settleAfterStart(page, timeoutMs = 20000, graceMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let lobbyGoneAt = null;
  while (Date.now() < deadline) {
    if (await page.getByRole('button', { name: 'Start', exact: true }).count()) return 'configuring';
    if (!(await page.getByRole('button', { name: 'Search games' }).count())) {
      if (lobbyGoneAt === null) lobbyGoneAt = Date.now();
      if (Date.now() - lobbyGoneAt >= graceMs) return 'in-game';
    } else {
      lobbyGoneAt = null;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('Room left the lobby but reached neither the config screen nor in-game');
}

async function waitForInGame(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillConfiguring = await page.getByRole('button', { name: 'Start', exact: true }).count();
    const stillLobby = await page.getByRole('button', { name: 'Search games' }).count();
    if (!stillConfiguring && !stillLobby) return;
    await page.waitForTimeout(200);
  }
  throw new Error('Room never reached in-game: config remote or lobby still on the host phone');
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
  const deadline = Date.now() + (opts.timeout || 15000);
  while (Date.now() < deadline) {
    // Every drill-down sub-screen (menu, share, about, search) carries a "Back" caret and the
    // game does not, so its presence means the phone is not showing the round at all.
    if (await page.getByRole('button', { name: 'Back', exact: true }).count()) {
      await page.waitForTimeout(opts.interval || 300);
      continue;
    }
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
    await page.waitForTimeout(opts.interval || 300);
  }
  if (opts.required === false) return false;
  throw new Error(`answerRound: controller never became answerable (needed >= ${minEnabled} enabled buttons)`);
}

// Polls instead of a fixed sleep: returns the moment the text appears, so a follow-up
// screenshot lands on that frame instead of an arbitrary later (or earlier) one.
async function pollUntilText(page, text, opts = {}) {
  const exact = !!opts.exact;
  const timeoutMs = opts.timeoutMs || 15000;
  const intervalMs = opts.intervalMs || 250;
  const matcher = exact ? text : new RegExp(text, 'i');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.getByText(matcher, { exact }).count()) return;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`pollUntilText timed out waiting for: ${text}`);
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

function runFromCli() {
  const args = process.argv.slice(2);
  const get = (flag, def = null) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };

  function usage() {
    console.error('Usage: node capture.cjs --plan <plan.json> [--out-dir <dir>] [--base-url <url>] [--session-id <pid-ticks>]');
    console.error('Plan schema: see .claude/skills/capture/SKILL.md');
  }

  const planPath = get('--plan');
  if (!planPath) { usage(); process.exit(1); }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read/parse plan file:', e.message);
    process.exit(1);
  }

  // Per the per-session screenshot rule: never fall back to the screenshots root.
  // Caller must pass --out-dir or --session-id/HUBBUB_CAPTURE_SESSION_ID explicitly.
  const sessionId = get('--session-id') || process.env.HUBBUB_CAPTURE_SESSION_ID || null;
  const outDir = get('--out-dir') || (sessionId ? path.join('.for_bepy', 'screenshots', sessionId) : null);
  if (!outDir) {
    console.error('No --out-dir given and no --session-id/HUBBUB_CAPTURE_SESSION_ID set.');
    console.error('Refusing to default to the screenshots root - pass one explicitly.');
    process.exit(1);
  }

  // One base-URL param covers apps/web dev (5175, the default), wrangler dev (8788) and the
  // deployed URL. Legacy dual-origin (apps/screen 5173 + apps/controller 5174) only kicks in
  // when the plan explicitly sets screenUrl/controllerUrl.
  const legacyScreenUrl = plan.screenUrl;
  const legacyControllerUrl = plan.controllerUrl;
  const isLegacy = !!(legacyScreenUrl || legacyControllerUrl);
  const baseUrl = get('--base-url') || plan.baseUrl || DEFAULT_BASE_URL;
  const screenUrl = isLegacy ? (legacyScreenUrl || 'http://localhost:5173') : baseUrl;
  const controllerUrl = isLegacy ? (legacyControllerUrl || 'http://localhost:5174') : baseUrl;

  const viewport = {
    tv: (plan.viewport && plan.viewport.tv) || { width: 1920, height: 1080 },
    controller: (plan.viewport && plan.viewport.controller) || { width: 390, height: 844 },
  };

  (async () => {
    let browser;
    try {
      browser = await chromium.launch({ channel: 'chrome' });
    } catch {
      browser = await chromium.launch();
    }
    const pages = new Map(); // id -> { page, log, ctx }
    let roomCode = null;

    async function getPage(id) {
      if (pages.has(id)) return pages.get(id).page;
      const isTv = id === 'tv';
      const ctx = await browser.newContext(
        isTv ? { viewport: viewport.tv } : { viewport: viewport.controller, isMobile: true, hasTouch: true },
      );
      const page = await ctx.newPage();
      const log = [];
      attachConsole(page, id, log);
      await page.goto(isTv ? screenUrl : controllerUrl, { waitUntil: 'networkidle' });
      pages.set(id, { page, log });
      return page;
    }

    try {
      for (const step of plan.steps) {
        switch (step.type) {
          case 'waitRoomCode': {
            const page = await getPage(step.page || 'tv');
            roomCode = await getRoomCode(page);
            console.log('Room code:', roomCode);
            break;
          }
          case 'identity': {
            const page = await getPage(step.page);
            await doIdentity(page, step.name, step.emoji, step.shot);
            // Remembered so answerRound can deny the identity header, whose accessible name is
            // the player's own name - it is enabled in every phase and opens the menu.
            pages.get(step.page).playerName = step.name;
            break;
          }
          case 'join': {
            if (!roomCode) throw new Error('join step ran before waitRoomCode');
            const page = await getPage(step.page);
            await joinRoom(page, roomCode);
            break;
          }
          case 'screenshot': {
            const page = await getPage(step.page);
            await shot(page, step.out);
            break;
          }
          case 'click': {
            const page = await getPage(step.page);
            await page.click(step.selector);
            break;
          }
          case 'clickRole': {
            const page = await getPage(step.page);
            await page.getByRole(step.role, { name: step.name, exact: step.exact !== false }).click();
            break;
          }
          case 'clickNth': {
            const page = await getPage(step.page);
            await page.locator(step.selector).nth(step.index).click();
            break;
          }
          case 'waitText': {
            const page = await getPage(step.page);
            const matcher = step.exact ? step.text : new RegExp(step.text);
            await page.getByText(matcher, { exact: !!step.exact }).waitFor({ timeout: step.timeout || 15000 });
            break;
          }
          case 'waitRole': {
            const page = await getPage(step.page);
            await page.getByRole(step.role, { name: step.name, exact: step.exact !== false })
              .waitFor({ timeout: step.timeout || 15000 });
            break;
          }
          case 'pollUntilText': {
            const page = await getPage(step.page);
            await pollUntilText(page, step.text, { exact: step.exact, timeoutMs: step.timeout, intervalMs: step.interval });
            if (step.shot) await shot(page, step.shot);
            break;
          }
          case 'startGame': {
            const page = await getPage(step.page);
            const phase = await startGame(page, step.game, { pressStart: step.pressStart, timeout: step.timeout });
            console.log(`startGame(${step.game}) settled in: ${phase}`);
            break;
          }
          case 'pressStart': {
            const page = await getPage(step.page || 'host');
            await pressStart(page, { timeout: step.timeout });
            break;
          }
          case 'answerRound': {
            const id = step.page;
            const page = await getPage(id);
            const answered = await answerRound(page, {
              minEnabled: step.minEnabled,
              index: step.index,
              timeout: step.timeout,
              interval: step.interval,
              required: step.required,
              playerName: pages.get(id).playerName,
            });
            console.log(`answerRound(${id}): ${answered ? 'answered' : 'skipped (not answerable)'}`);
            break;
          }
          case 'playToEndOfRound': {
            const hostPage = await getPage(step.page || 'host');
            const tvPage = await getPage(step.tvPage || 'tv');
            await playToEndOfRound(hostPage, tvPage, step.game, step.endText, step.timeout, { pressStart: step.pressStart });
            if (step.shot) await shot(tvPage, step.shot);
            break;
          }
          case 'throttle': {
            const page = await getPage(step.page);
            await setThrottle(page, step);
            break;
          }
          case 'unthrottle': {
            const page = await getPage(step.page);
            await clearThrottle(page);
            break;
          }
          case 'wait': {
            const page = await getPage(step.page || 'tv');
            await page.waitForTimeout(step.ms);
            break;
          }
          case 'evaluate': {
            const page = await getPage(step.page);
            await page.evaluate(step.js);
            break;
          }
          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }
      }

      for (const [id, { log }] of pages) {
        console.log(`--- CONSOLE LOGS (${id}) ---`);
        console.log(log.join('\n') || '(none)');
      }
    } catch (err) {
      console.error('FAILURE:', err.message);
      for (const [id, { page, log }] of pages) {
        try { await page.screenshot({ path: path.join(outDir, `debug-${id}.png`) }); } catch (e) {}
        console.error(`--- DOM ${id} ---`);
        try { console.error((await page.content()).slice(0, 3000)); } catch (e) {}
        console.error(`--- CONSOLE LOGS (${id}) ---`);
        console.error(log.join('\n') || '(none)');
      }
      await browser.close();
      process.exit(1);
    }

    await browser.close();
  })();
}

if (require.main === module) runFromCli();

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
  CODE_ALPHABET,
  ROOM_CODE_LENGTH,
};
