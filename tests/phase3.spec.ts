import { expect, test } from 'playwright/test';
import { TRACKS, assertClean, listen, mockThirdParties, telemetry, type DebugHandle } from './support';

// ---------------------------------------------------------------------------
// Phase 3 smoke: a real ride, the scene's own crash, the result screen, and the
// shared /r/ link.
//
// Nothing here drives physics. The only nudge is the scene's test-only
// `wreck()` hook, which lies the bike on its head — after that it is the
// scene's own crash rules that decide, and its RUN_RESULT emission is what the
// chrome (best-run ghost + result screen) and this test both consume. The
// share sheet is captured instead of opened, because Linux Chromium has no
// `navigator.share` and the app's own share text is what needs asserting.
//
// Software-rendered headless Chromium runs this scene well under 60 fps, and
// Phaser clamps the game clock's delta below its 30 fps floor — so every
// in-game timer (the 1.4 s crash-to-result delay included) stretches with the
// frame rate. A smaller viewport keeps the frame rate high enough that the
// whole check stays well inside a minute.
// ---------------------------------------------------------------------------

test.use({ viewport: { width: 800, height: 500 } });

/** Window surface the init script installs to capture the share sheet. */
interface ShareProbe {
  __sharedText: string[];
}

test('a crash shows the result screen and shares a /r/ link that replays', async ({ page }) => {
  // The whole run stays well inside a minute: gate, short ride, crash delay.
  test.setTimeout(60_000);
  test.skip(TRACKS.length === 0, 'smoke: public/tracks/index.json has no published tracks — crash test skipped');

  const { consoleErrors, pageErrors, external } = listen(page);
  await mockThirdParties(page, external);

  await page.addInitScript(() => {
    const probe = window as unknown as ShareProbe;
    probe.__sharedText = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: { text?: string }) => {
        probe.__sharedText.push(data.text ?? '');
        return Promise.resolve();
      },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
  });

  // A live track, same pick the engine's own fallback ride makes.
  const track = TRACKS.find((t) => t.kind === 'live') ?? TRACKS[0];
  await page.goto(`/ride/${track.id}`);

  // 3-2-1-RIDE: the gate holds the run and resets it when it lifts, so ride
  // only after its hint line has come and gone. The hint is in the DOM for the
  // whole countdown and never returns, so a miss means it already lifted.
  const gateHint = page.getByText(/W GAS · A\/D LEAN/);
  const gated = await gateHint.waitFor({ state: 'visible', timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  if (gated) await expect(gateHint).toHaveCount(0);

  await page.waitForFunction(() => Boolean((window as unknown as { __oddsrider?: DebugHandle }).__oddsrider));

  // Ride for real, so the run has telemetry and recorded poses to replay.
  const start = await telemetry(page);
  await page.keyboard.down('w');
  await expect
    .poll(async () => (await telemetry(page)).x, { timeout: 15_000 })
    .toBeGreaterThan(start.x + 20);
  await page.waitForTimeout(1200);

  // Force the crash through the scene's own detection: the hook only poses the
  // bike, then Bike.step's crash rules fire.
  await page.evaluate(() =>
    (window as unknown as { __oddsrider: { wreck: () => void } }).__oddsrider.wreck(),
  );
  await page.keyboard.up('w');

  // The result screen is built from the scene's RUN_RESULT — no test emit.
  const screen = page.getByRole('dialog', { name: 'Run result' });
  await expect(screen).toBeVisible();
  await expect(screen.getByRole('heading', { level: 2 })).toContainText(/Crashed at \d+%/);
  await expect(screen.getByLabel('Replay of the last seconds of the run')).toBeVisible();

  // Proof that the scene emitted EV.RUN_RESULT from its own crash: the page
  // saves a best-run ghost only from that event, and only with snapshots.
  const ghosts = await page.evaluate(() => {
    const raw = window.localStorage.getItem('oddsrider_ghosts_v1');
    return raw ? (JSON.parse(raw) as Record<string, { finished: boolean; snapshots: unknown[] }>) : {};
  });
  const saved = Object.values(ghosts)[0];
  expect(saved, "the scene's crash must publish RUN_RESULT with snapshots").toBeTruthy();
  expect(saved?.finished).toBe(false);
  expect(saved?.snapshots.length).toBeGreaterThan(1);

  // Share: the app hands the platform (here: our stub) its own /r/ link.
  await screen.getByRole('button', { name: 'Share' }).click();
  await expect(screen.getByRole('button', { name: 'Shared' })).toBeVisible();

  const origin = new URL(page.url()).origin;
  const shared = await page.evaluate(() => (window as unknown as ShareProbe).__sharedText[0] ?? '');
  expect(shared).toContain(`I rode "${track.question}" and crashed at `);
  const link = shared.split('— beat me: ')[1]?.trim() ?? '';
  expect(link.startsWith(`${origin}/r/`)).toBe(true);

  // The link is the replay: it loads, paints and plays on its own.
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Crashed at \d+%/);
  await expect(page.getByLabel('Replay of the shared run')).toBeVisible();
  const scrub = page.getByLabel('Replay position');
  const before = Number(await scrub.inputValue());
  await expect
    .poll(async () => Number(await scrub.inputValue()), { timeout: 10_000 })
    .toBeGreaterThan(before);

  await page.screenshot({ path: 'test-results/smoke-replay.png' });
  assertClean(consoleErrors, pageErrors, external);
});
