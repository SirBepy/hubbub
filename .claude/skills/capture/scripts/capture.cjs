const fs = require('fs');
const path = require('path');

// Re-exported wholesale at the bottom: SKILL.md documents this path as the import surface for
// one-off scripts, so every action name has to keep resolving from here after the split.
const actions = require('./capture-actions.cjs');
const {
  resolvePlaywright,
  attachConsole,
  shot,
  getRoomCode,
  doIdentity,
  joinRoom,
  startGame,
  pressStart,
  answerRound,
  pollUntilText,
  playToEndOfRound,
  setThrottle,
  clearThrottle,
  DEFAULT_BASE_URL,
} = actions;
const { chromium } = resolvePlaywright();

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

module.exports = actions;
