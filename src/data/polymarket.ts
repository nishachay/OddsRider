/**
 * Compatibility surface for the untouched game engine.
 *
 * `src/game/` imports its ride hook and shared types from this path, and that
 * path must not change. Everything real now lives in `./tracks` (frozen
 * `/tracks/*.json`, zero Polymarket calls); this module only re-exports what
 * the engine consumes. App code must import from `./tracks` directly.
 */
export type { Difficulty, PricePoint, Ride, RideableMarket } from './tracks';
export { fetchRide } from './tracks';
