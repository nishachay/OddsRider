/**
 * Shared helpers for the offline Playwright smokes.
 *
 * Both specs boot the built app, read only our own `/tracks/*.json`, stub
 * Google Fonts and abort every other outbound request, so a new network call
 * anywhere in the app fails the run loudly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from 'playwright/test';

export interface TrackSummary {
  id: string;
  kind: string;
  question: string;
}

/** The frozen manifest, or [] when nothing has been published. */
export function trackIndex(): TrackSummary[] {
  let raw: string;
  try {
    const path = fileURLToPath(new URL('../public/tracks/index.json', import.meta.url));
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const index = JSON.parse(raw) as { tracks?: TrackSummary[] };
  return Array.isArray(index.tracks) ? index.tracks : [];
}

export const TRACKS = trackIndex();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export interface Telemetry {
  x: number;
  y: number;
  angle: number;
  speed: number;
  grounded: boolean;
  crashed: boolean;
  score: number;
  simMs: number;
}

export type DebugHandle = Record<string, () => unknown>;

export async function telemetry(page: Page): Promise<Telemetry> {
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

// Everything third-party is stubbed or forbidden. `external` collects anything
// that is neither local nor stubbed, so a new outbound call — a Polymarket
// request, an analytics pixel, anything — fails the test loudly.
export async function mockThirdParties(page: Page, external: string[]): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

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

export interface Listeners {
  consoleErrors: string[];
  pageErrors: string[];
  external: string[];
}

export function listen(page: Page): Listeners {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const external: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors, external };
}

export function assertClean(
  consoleErrors: string[],
  pageErrors: string[],
  external: string[],
  ignoredConsole: RegExp[] = [],
): void {
  const relevant = consoleErrors.filter((message) => !ignoredConsole.some((re) => re.test(message)));
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(relevant, `console errors:\n${relevant.join('\n')}`).toEqual([]);
  expect(external, `the smoke test must not reach the network, but saw:\n${external.join('\n')}`).toEqual([]);
}
