import { afterEach, describe, expect, it } from 'vitest';
import { GAME_ASSET_URLS, preloadGameAssets } from './assetPreload';

const OriginalImage = (globalThis as { Image?: unknown }).Image;

afterEach(() => {
  if (OriginalImage === undefined) delete (globalThis as { Image?: unknown }).Image;
  else (globalThis as { Image?: unknown }).Image = OriginalImage;
});

/** Stand-in for the browser Image: settles on a microtask when `src` is set. */
function stubImage(fail: boolean): { srcs: string[] } {
  const srcs: string[] = [];
  class Stub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      srcs.push(url);
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  (globalThis as { Image?: unknown }).Image = Stub;
  return { srcs };
}

describe('preloadGameAssets', () => {
  it('warms every sprite and reports progress once each settles', async () => {
    const { srcs } = stubImage(false);
    const seen: number[] = [];
    await preloadGameAssets((loaded, total) => {
      expect(total).toBe(GAME_ASSET_URLS.length);
      seen.push(loaded);
    });
    expect(srcs).toEqual([...GAME_ASSET_URLS]);
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(GAME_ASSET_URLS.length);
    // Monotonic: the bar never jumps backwards.
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('counts a failed asset as settled so the bar never hangs', async () => {
    stubImage(true);
    const seen: number[] = [];
    await preloadGameAssets((loaded) => seen.push(loaded));
    expect(seen.at(-1)).toBe(GAME_ASSET_URLS.length);
  });

  it('resolves immediately where there is no DOM', async () => {
    delete (globalThis as { Image?: unknown }).Image;
    await expect(preloadGameAssets()).resolves.toBeUndefined();
  });
});
