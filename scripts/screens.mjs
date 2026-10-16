// Captures Phase 2 screens on desktop + phone sizes into docs/screens/phase2/.
// Run: pnpm build && node scripts/screens.mjs  (starts its own preview server)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'docs/screens/phase2';
const BASE = 'http://localhost:4173';

async function stubThirdParties(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stub */' });
    }
    return route.continue();
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
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
  try {
    // Desktop
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await stubThirdParties(desktop);
    await desktop.goto(BASE + '/');
    await desktop.getByText(/press any key/i).waitFor({ timeout: 30000 });
    await desktop.waitForTimeout(2500);
    await desktop.screenshot({ path: `${OUT}/title-desktop.png` });
    await desktop.goto(BASE + '/tracks');
    await desktop.getByText(/pick your track/i).waitFor({ timeout: 15000 });
    await desktop.waitForTimeout(500);
    await desktop.screenshot({ path: `${OUT}/tracks-desktop.png` });
    await desktop.goto(BASE + '/daily');
    await desktop.getByText(/one track\. everyone\./i).waitFor({ timeout: 15000 });
    await desktop.waitForTimeout(500);
    await desktop.screenshot({ path: `${OUT}/daily-desktop.png` });
    await desktop.close();

    // Phone (touch, portrait)
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await stubThirdParties(phone);
    await phone.goto(BASE + '/');
    await phone.getByText(/press any key/i).waitFor({ timeout: 30000 });
    await phone.waitForTimeout(2500);
    await phone.screenshot({ path: `${OUT}/title-phone.png` });
    await phone.goto(BASE + '/tracks');
    await phone.getByText(/pick your track/i).waitFor({ timeout: 15000 });
    await phone.waitForTimeout(500);
    await phone.screenshot({ path: `${OUT}/tracks-phone.png` });
    await phone.goto(BASE + '/daily');
    await phone.getByText(/one track\. everyone\./i).waitFor({ timeout: 15000 });
    await phone.waitForTimeout(500);
    await phone.screenshot({ path: `${OUT}/daily-phone.png` });
    await phone.close();
  } finally {
    await browser.close();
    killServer();
  }
  console.log(`screens written to ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
