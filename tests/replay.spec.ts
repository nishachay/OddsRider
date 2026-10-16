import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from 'playwright/test';

// ---------------------------------------------------------------------------
// Deterministic replay test.
//
// Records a scripted run, replays the exact recorded inputs, and requires the
// final position, time, crash state and score to match EXACTLY. Wall-clock
// timing differs between the two passes by construction (headless fps wobble),
// so equality proves the physics depends only on the per-step input sequence.
// ---------------------------------------------------------------------------

interface TrackSummary {
  id: string;
  kind: string;
}

function firstLiveTrackId(): string {
  const path = fileURLToPath(new URL('../public/tracks/index.json', import.meta.url));
  const index = JSON.parse(readFileSync(path, 'utf8')) as { tracks?: TrackSummary[] };
  const live = (index.tracks ?? []).find((t) => t.kind === 'live') ?? index.tracks?.[0];
  if (!live) throw new Error('no published tracks for the replay test');
  return live.id;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

async function mockThirdParties(page: Page, external: string[]): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stub */' });
    }
    if (LOCAL_HOSTS.has(url.hostname)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
}

interface RunState {
  x: number;
  timeMs: number;
  crashed: boolean;
  score: number;
  endStep: number;
}

// A scripted ride touching every input: gas, leans, jumps, nitro.
// The final sample and the recording come from ONE evaluate call: steps keep
// running between JS tasks, so sampling them separately would compare two
// different step counts and fail on a coasting bike.
async function scriptedRun(page: Page): Promise<{ recording: unknown; final: RunState }> {
  await page.keyboard.down('w');
  await page.waitForTimeout(2500);
  await page.keyboard.press(' ');
  await page.waitForTimeout(800);
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(900);
  await page.keyboard.up('Shift');
  await page.keyboard.down('a');
  await page.waitForTimeout(700);
  await page.keyboard.up('a');
  await page.keyboard.press(' ');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');

  return page.evaluate(() => {
    const h = window.__oddsrider as unknown as Record<string, () => unknown>;
    const rec = h.recording() as { recording: unknown; endStep: number };
    return {
      recording: rec.recording,
      final: {
        x: h.x() as number,
        timeMs: h.simMs() as number,
        crashed: h.crashed() as boolean,
        score: h.score() as number,
        endStep: rec.endStep,
      },
    };
  });
}

test('recorded inputs replay to the exact same run', async ({ page }) => {
  const external: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await mockThirdParties(page, external);

  await page.goto(`/ride/${firstLiveTrackId()}`);
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __oddsrider?: unknown }).__oddsrider));
  // Past the countdown gate (it ends by resetting the bike to the start).
  await expect(page.getByText(/W GAS/)).toHaveCount(0);
  await page.waitForTimeout(1200);

  const { recording, final } = await scriptedRun(page);
  expect(final.endStep).toBeGreaterThan(30);

  // Replay the exact recorded inputs from a clean reset.
  await page.evaluate((rec) => {
    const h = window.__oddsrider as unknown as Record<string, (a?: unknown) => unknown>;
    (h.reset as () => void)();
    (h.replayRun as (r: unknown) => void)(rec);
  }, recording);

  const endStep = final.endStep;
  await page.waitForFunction(
    (want) => {
      const h = window.__oddsrider as unknown as Record<string, () => number>;
      return h.replayStep() >= want;
    },
    endStep,
    { timeout: 120000 },
  );
  await page.waitForTimeout(500);

  const replayed = await page.evaluate(() => {
    const h = window.__oddsrider as unknown as Record<string, () => number | boolean>;
    return {
      x: h.x() as number,
      timeMs: h.simMs() as number,
      crashed: h.crashed() as boolean,
      score: h.score() as number,
    };
  });

  expect(replayed.x).toBe(final.x);
  expect(replayed.timeMs).toBe(final.timeMs);
  expect(replayed.crashed).toBe(final.crashed);
  expect(replayed.score).toBe(final.score);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(external).toEqual([]);
});
