import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from 'playwright/test';

// ---------------------------------------------------------------------------
// Offline smoke test.
//
// This test never touches the network. Polymarket (Gamma + CLOB) responses come
// from tests/fixtures, Google Fonts is stubbed, and any other external request
// is aborted and reported as a failure. Everything it rides is local and
// deterministic.
//
// Scope: the app shell boots, a ride starts, the bike moves under its own
// power, and the console stays clean. Gameplay physics are not asserted here.
// ---------------------------------------------------------------------------

interface HistoryPoint {
  t: number;
  p: number;
}

function fixture<T>(name: string): T {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const GAMMA_MARKETS = fixture<unknown[]>('gamma-markets.json');
const CLOB_HISTORY = fixture<Record<string, HistoryPoint[]>>('clob-history.json');

// The tracked fixture the test expects to ride: the highest-volume market, which
// is what the arcade stage selects on load.
const FIXTURE_TRACK_ID = '100001';
const FIXTURE_QUESTION = 'Will the fixture rate cut land in Q3?';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

interface Telemetry {
  x: number;
  y: number;
  angle: number;
  speed: number;
  grounded: boolean;
  crashed: boolean;
  score: number;
  simMs: number;
}

type DebugHandle = Record<string, () => unknown>;

async function telemetry(page: Page): Promise<Telemetry> {
  return page.evaluate(() => {
    const handle = (window as unknown as { __oddsrider?: DebugHandle }).__oddsrider;
    if (!handle) throw new Error('window.__oddsrider is not installed');
    return {
      x: handle.x() as number,
      y: handle.y() as number,
      angle: handle.angle() as number,
      speed: handle.speed() as number,
      grounded: handle.grounded() as boolean,
      crashed: handle.crashed() as boolean,
      score: handle.score() as number,
      simMs: handle.simMs() as number,
    };
  });
}

// Serve every third-party call from disk. `external` collects anything that is
// neither local nor mocked, so a new outbound call fails the test loudly.
async function mockThirdParties(page: Page, external: string[]): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.hostname === 'gamma-api.polymarket.com') {
      return route.fulfill({ json: GAMMA_MARKETS });
    }
    if (url.hostname === 'clob.polymarket.com') {
      const token = url.searchParams.get('market') ?? '';
      return route.fulfill({ json: { history: CLOB_HISTORY[token] ?? [] } });
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* stubbed: the smoke test runs offline */',
      });
    }
    if (LOCAL_HOSTS.has(url.hostname)) {
      return route.continue();
    }

    external.push(route.request().url());
    return route.abort();
  });
}

test('starts a ride from fixture data with no console errors and no network', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const external: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await mockThirdParties(page, external);

  // --- Home: the fixture feed must be accepted, not the bundled fallback ----
  await page.goto('/');
  await expect(page.getByText(FIXTURE_QUESTION).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/smoke-home.png' });

  // --- Start the ride --------------------------------------------------------
  // The stage CTA drops straight into the game for the selected fixture track.
  await page.getByRole('button', { name: /enter race/i }).click();
  await expect(page).toHaveURL(new RegExp(`/ride/${FIXTURE_TRACK_ID}$`));

  // --- The game boots and installs its debug handle --------------------------
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(
    () => Boolean((window as unknown as { __oddsrider?: DebugHandle }).__oddsrider),
  );

  // Let the 3-2-1-RIDE gate finish: it ends by resetting the bike to the start,
  // so holding throttle through it would test nothing.
  await expect(page.getByText(/W GAS/)).toHaveCount(0);
  await page.waitForTimeout(1200);

  const before = await telemetry(page);
  expect(Number.isFinite(before.x)).toBe(true);
  expect(before.simMs).toBeGreaterThanOrEqual(0);

  // --- Ride: hold throttle and watch the bike make progress ------------------
  await page.keyboard.down('w');
  let furthest = before.x;
  let fastest = 0;
  let sawSimulation = before.simMs;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const sample = await telemetry(page);
    furthest = Math.max(furthest, sample.x);
    fastest = Math.max(fastest, sample.speed);
    sawSimulation = Math.max(sawSimulation, sample.simMs);
  }
  await page.keyboard.up('w');

  await page.screenshot({ path: 'test-results/smoke-ride.png' });

  expect(sawSimulation).toBeGreaterThan(before.simMs);
  expect(furthest).toBeGreaterThan(before.x + 20);
  expect(fastest).toBeGreaterThan(0);

  // --- Nothing may have errored, nothing may have left the box --------------
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(external, `the smoke test must not reach the network, but saw:\n${external.join('\n')}`).toEqual([]);
});
