import { Suspense, lazy, useEffect, useState } from 'react';
import PreloadBar from './PreloadBar';
import { preloadGameAssets } from '../game/assetPreload';

const PhaserGame = lazy(() => import('../game/PhaserGame'));

/**
 * Wrap Phaser's camera shake so the reduced-motion preference silences it.
 * The gate itself lives in `src/game/motion.ts` (scene files stay untouched);
 * Phaser is imported dynamically here so it never reaches the main bundle.
 */
function useScreenShakeGate(): void {
  useEffect(() => {
    let cancelled = false;
    void Promise.all([import('../game/motion'), import('phaser')]).then(([motion, phaser]) => {
      if (cancelled) return;
      motion.gateCameraShake(phaser.default.Cameras.Scene2D.Camera.prototype);
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

/**
 * The Phaser stage behind an honest preload gate. Sprite files are fetched
 * here first (BootScene then reads them from the browser cache), so the bar
 * tracks real assets rather than a guessed duration.
 */
export default function GameStage({ label = 'Loading assets' }: { label?: string }) {
  const [progress, setProgress] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);

  useScreenShakeGate();

  useEffect(() => {
    let cancelled = false;
    preloadGameAssets((loaded, total) => {
      if (!cancelled) setProgress(total === 0 ? 1 : loaded / total);
    }).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!assetsReady) return <PreloadBar progress={progress} label={label} />;
  return (
    <Suspense fallback={<PreloadBar progress={1} label="Starting engine" />}>
      <PhaserGame />
    </Suspense>
  );
}
