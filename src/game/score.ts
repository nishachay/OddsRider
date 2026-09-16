import { WORLD } from './constants';
import type { Difficulty } from '../data/polymarket';

// Star bars per difficulty — harder tracks earn stars cheaper.
// Same table drives the result modal and share copy.
const STAR_BARS: Record<Difficulty, number[]> = {
  EASY: [1000, 2500, 4000, 6000, 8000],
  MEDIUM: [800, 2000, 3200, 4800, 6500],
  HARD: [600, 1500, 2500, 3800, 5200],
  INSANE: [400, 1000, 1800, 2800, 4000],
  NEW: [800, 2000, 3200, 4800, 6500],
};

export function starsFor(score: number, difficulty: Difficulty): number {
  const bars = STAR_BARS[difficulty] ?? STAR_BARS.MEDIUM;
  let stars = 0;
  for (const bar of bars) {
    if (score >= bar) stars += 1;
  }
  return stars;
}

export class RideScore {
  total = 0;
  timeMs = 0;
  finished = false;
  started = false;
  combo = 1;

  private bonus = 0;
  private penalty = 0;
  private trickPoints = 0;
  private maxX: number;
  private spawnX: number;

  constructor() {
    this.spawnX = WORLD.spawnX;
    this.maxX = WORLD.spawnX;
  }

  begin(): void {
    this.started = true;
  }

  setCourse(spawnX: number): void {
    this.spawnX = spawnX;
    this.fullReset();
  }

  fullReset(): void {
    this.total = 0;
    this.timeMs = 0;
    this.finished = false;
    this.started = false;
    this.combo = 1;
    this.bonus = 0;
    this.penalty = 0;
    this.trickPoints = 0;
    this.maxX = this.spawnX;
  }

  // Combo trick: points scale with current multiplier, then it climbs (max x5).
  awardTrick(base: number): number {
    if (this.finished) return 0;
    const pts = base * this.combo;
    this.trickPoints += pts;
    this.combo = Math.min(5, this.combo + 1);
    this.recompute();
    return pts;
  }

  // Big air pays flat, no combo change.
  awardAir(): number {
    return this.awardFlat(200);
  }

  // Flat award with no combo change (air, nitro burn).
  awardFlat(points: number): number {
    if (this.finished) return 0;
    this.trickPoints += points;
    this.recompute();
    return points;
  }

  applyCrash(): void {
    if (this.finished) return;
    this.penalty += 500;
    this.combo = 1;
    this.recompute();
  }

  applyFinish(): void {
    if (this.finished) return;
    this.finished = true;
    this.bonus = 1000;
    this.recompute();
  }

  step(dtMs: number, x: number): void {
    if (this.finished || !this.started) return;
    this.timeMs += dtMs;
    if (x > this.maxX) this.maxX = x;
    this.recompute();
  }

  private recompute(): void {
    const span = WORLD.finishX - this.spawnX;
    const progress = span > 0 ? Math.min(1000, Math.floor(((this.maxX - this.spawnX) / span) * 1000)) : 0;
    this.total = Math.max(0, progress + this.bonus + this.trickPoints - this.penalty);
  }
}
