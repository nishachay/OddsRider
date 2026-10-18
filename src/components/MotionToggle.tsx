import { useCallback, useEffect, useState } from 'react';
import { applyReducedMotion, loadReducedMotion, storeReducedMotion } from '../data/motion';

/**
 * Reduced-motion switch. The OS setting is the default until the rider picks,
 * then their choice sticks (localStorage) and is mirrored onto <html> for the
 * CSS. It turns off the site's reveal/pulse motion and the game's screen shake
 * (the gate in `src/game/motion.ts` reads the same preference).
 */
export default function MotionToggle() {
  const [reduced, setReduced] = useState(loadReducedMotion);

  useEffect(() => {
    applyReducedMotion(reduced);
  }, [reduced]);

  const toggle = useCallback(() => {
    setReduced((prev) => {
      const next = !prev;
      storeReducedMotion(next);
      applyReducedMotion(next);
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={reduced}
      title={
        reduced
          ? 'Reduced motion: animations and screen shake are off'
          : 'Full motion: animations and screen shake are on'
      }
      className={`font-mono text-[10px] font-bold tracking-[0.22em] uppercase cursor-pointer transition-colors ${
        reduced ? 'text-toxic' : 'text-dim hover:text-toxic'
      }`}
    >
      Motion {reduced ? 'reduced' : 'full'}
    </button>
  );
}
