/** Shared numeric constants. Kept separate so schemas never import the generator. */

/** Points kept per frozen track. */
export const TARGET_POINTS = 600;

/** Points kept in each track's card preview silhouette. Real data, downsampled. */
export const PREVIEW_POINTS = 48;

/** A frozen series needs at least this many points to become a track. */
export const MIN_HISTORY_POINTS = 15;

/** A frozen series needs at least this much range to be worth riding. */
export const MIN_TRACK_RANGE = 0.03;

/** A probability track never touches the rails: 0 and 1 are not rideable. */
export const PROBABILITY_FLOOR = 0.01;
export const PROBABILITY_CEIL = 0.99;

/** Below this many points a trailing window is too thin to be a track. */
export const MIN_WINDOW_POINTS = 12;
