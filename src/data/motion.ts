/**
 * Reduced-motion preference: one stored switch, with the OS setting as the
 * default. The choice is mirrored onto <html> as `data-reduced-motion`, so the
 * CSS can silence the motion set without a media query, and non-React readers
 * (the game's screen-shake gate) can ask `motionReduced()`.
 */

export const REDUCED_MOTION_KEY = 'oddsrider_reduced_motion';

/** localStorage can throw in private mode; every access goes through here. */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The rider's saved choice, or null when they have never touched the toggle. */
export function storedMotionChoice(): boolean | null {
  const raw = storage()?.getItem(REDUCED_MOTION_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

/** The OS/browser setting: true when less motion was asked for system-wide. */
export function systemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Effective preference: the saved choice wins, the OS setting is the default. */
export function loadReducedMotion(): boolean {
  return storedMotionChoice() ?? systemReducedMotion();
}

export function storeReducedMotion(reduced: boolean): void {
  try {
    storage()?.setItem(REDUCED_MOTION_KEY, reduced ? '1' : '0');
  } catch {
    // Private mode: the choice still holds for this page via the attribute.
  }
}

/** Mirror the preference onto <html> so CSS can react without a media query. */
export function applyReducedMotion(reduced: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-reduced-motion', reduced ? 'true' : 'false');
}

/** Effective preference for non-React readers — the game's screen-shake gate. */
export function motionReduced(): boolean {
  return loadReducedMotion();
}
