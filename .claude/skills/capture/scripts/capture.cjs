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
const ROOM_CODE_LENGTH = 6;

const args = process.argv.slice(2);
const get = (flag, def = null) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };

function usage() {
  console.error('Usage: node capture.cjs --plan <plan.json> --out-dir <dir>');
  console.error('Plan schema: see .claude/skills/capture/SKILL.md');
}

const planPath = get('--plan');
const outDir = get('--out-dir');
if (!planPath || !outDir) { usage(); process.exit(1); }

let plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (e) {
  console.error('Failed to read/parse plan file:', e.message);
  process.exit(1);
}

const screenUrl = plan.screenUrl || 'http://localhost:5173';
const controllerUrl = plan.controllerUrl || 'http://localhost:5174';
const viewport = {
  tv: (plan.viewport && plan.viewport.tv) || { width: 1920, height: 1080 },
  controller: (plan.viewport && plan.viewport.controller) || { width: 390, height: 844 },
};

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
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function shot(page, outPath) {
  await settle(page);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
  console.log('Saved:', outPath);
}

async function getRoomCode(page) {
  const re = new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
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

async function doIdentity(page, name, colorName, emoji, shotOut) {
  await page.getByPlaceholder('Your name').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: colorName, exact: true }).click();
  await page.getByRole('button', { name: emoji, exact: true }).click();
  if (shotOut) await shot(page, shotOut);
  await page.getByRole('button', { name: 'Save identity', exact: true }).click();
}

async function joinRoom(page, code) {
  await page.getByPlaceholder('CODE').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('CODE').fill(code);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await page.getByText(/PICK A GAME/i).waitFor({ timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  const pages = new Map(); // id -> { page, log }
  let roomCode = null;

  // "tv" is the reserved id for the screen app; any other id is a controller.
  async function getPage(id) {
    if (pages.has(id)) return pages.get(id).page;
    const isTv = id === 'tv';
    const ctx = await browser.newContext({ viewport: isTv ? viewport.tv : viewport.controller });
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
          await doIdentity(page, step.name, step.color, step.emoji, step.shot);
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
