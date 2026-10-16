// Measures load-to-riding on a throttled connection: fresh load of `/`,
// immediate keypress at the prompt, then time until the bike moves on /ride.
// Run: pnpm build && node scripts/measure-load.mjs  (starts its own preview)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const RUNS = 3;

async function stubFonts(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stub */' });
    }
    return route.continue();
  });
}

async function measure(browser, i) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await stubFonts(page);
  // Fast 3G: ~1.6 Mbps down, 150ms RTT.
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
    latency: 150,
  });
  const t0 = Date.now();
  await page.goto(BASE + '/');
  await page.getByText(/press any key/i).waitFor({ timeout: 120000 });
  const tPrompt = Date.now();
  await page.keyboard.press('x');
  await page.waitForURL(/\/ride\//, { timeout: 60000 });
  // Riding = the countdown is done and the bike moves under held gas.
  await page.waitForFunction(
    () => Boolean(window.__oddsrider),
    null,
    { timeout: 120000 },
  );
  await expectGateDone(page);
  const t1 = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const h = window.__oddsrider;
        const x0 = h.x();
        const start = Date.now();
        const down = new KeyboardEvent('keydown', { code: 'KeyW' });
        window.dispatchEvent(down);
        const tick = () => {
          if (h.x() > x0 + 20 || h.speed() > 0) {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
            resolve(Date.now());
          } else if (Date.now() - start > 60000) {
            resolve(-1);
          } else {
            setTimeout(tick, 200);
          }
        };
        tick();
      }),
  );
  await page.close();
  if (t1 === -1) throw new Error(`run ${i}: bike never moved`);
  return { total: t1 - t0, prompt: tPrompt - t0, t0: new Date(t0).toISOString() };
}

async function expectGateDone(page) {
  await page.waitForFunction(
    () => ![...document.body.innerText.matchAll(/W GAS/g)].length,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1200);
}

async function main() {
  const server = spawn('pnpm', ['preview'], { stdio: 'ignore', detached: true });
  const killServer = () => {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      server.kill();
    }
  };
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const results = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      const r = await measure(browser, i);
      results.push(r.total);
      console.log(`run ${i + 1}: prompt ${(r.prompt / 1000).toFixed(1)}s, load-to-riding ${(r.total / 1000).toFixed(1)}s`);
    }
  } finally {
    await browser.close();
    killServer();
  }
  results.sort((a, b) => a - b);
  console.log(`median load-to-riding: ${(results[Math.floor(results.length / 2)] / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
