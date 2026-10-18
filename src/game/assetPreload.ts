/**
 * React-side asset preloader for the ride stage (additive: the scene's own
 * BootScene still loads these files — this only warms the browser cache so the
 * shell can show real progress instead of a fake timer).
 *
 * URLs mirror `src/game/scenes/BootScene.ts`. A file that fails to load settles
 * like the others: a missing sprite is the scene's problem to render, never a
 * reason to trap the player behind a progress bar.
 */
export const GAME_ASSET_URLS = [
  '/assets/game/wheel.png',
  '/assets/game/bike.png',
  '/assets/game/rider.png',
  '/assets/game/ragdoll.png',
  '/assets/game/flag.png',
] as const;

export type AssetProgress = (loaded: number, total: number) => void;

export function preloadGameAssets(onProgress?: AssetProgress): Promise<void> {
  const total = GAME_ASSET_URLS.length;
  onProgress?.(0, total);
  // No DOM (unit tests, exotic runtimes): nothing to warm, resolve at once.
  if (typeof Image === 'undefined') return Promise.resolve();

  let loaded = 0;
  return Promise.all(
    GAME_ASSET_URLS.map(
      (url) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            loaded += 1;
            onProgress?.(loaded, total);
            resolve();
          };
          const img = new Image();
          img.onload = done;
          img.onerror = done;
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}
