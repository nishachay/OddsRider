import type { PricePoint } from '../data/polymarket';
import { WORLD, TERRAIN } from './constants';

export interface TerrainPoint {
  x: number;
  y: number;
  p: number;
}

export interface TerrainSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  rising: boolean;
}

export interface Terrain {
  points: TerrainPoint[];
  segments: TerrainSegment[];
}

function probToY(p: number): number {
  return TERRAIN.bandBottomY - p * (TERRAIN.bandBottomY - TERRAIN.bandTopY);
}

function smooth(values: number[], passes: number): number[] {
  let out = values.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = out.slice();
    for (let i = 1; i < out.length - 1; i++) {
      next[i] = out[i - 1] * 0.25 + out[i] * 0.5 + out[i + 1] * 0.25;
    }
    out = next;
  }
  return out;
}

export function buildTerrain(series: PricePoint[]): Terrain {
  const pts = series.slice().sort((a, b) => a.t - b.t);
  const n = pts.length;
  if (n < 2) {
    const y = probToY(pts[0]?.p ?? 0.5);
    const flat: TerrainPoint[] = [
      { x: WORLD.spawnX, y, p: pts[0]?.p ?? 0.5 },
      { x: WORLD.finishX, y, p: pts[0]?.p ?? 0.5 },
    ];
    return { points: flat, segments: [] };
  }

  let minP = Infinity;
  let maxP = -Infinity;
  for (const pt of pts) {
    if (pt.p < minP) minP = pt.p;
    if (pt.p > maxP) maxP = pt.p;
  }

  // Ensure minimum padding if the market is completely flat
  if (maxP - minP < 0.05) {
    const mid = (maxP + minP) / 2;
    maxP = Math.min(1, mid + 0.025);
    minP = Math.max(0, mid - 0.025);
  }
  const range = maxP - minP;

  const rawProbs = pts.map((pt) => {
    const norm = (pt.p - minP) / range;
    return Math.min(1, Math.max(0, norm));
  });

  // No smoothing - exact 1:1 raw data mapping for maximum volatility
  const probs = rawProbs;

  const minT = pts[0].t;
  const maxT = pts[n - 1].t;
  const tSpan = maxT - minT;
  
  const graphStartX = WORLD.spawnX + TERRAIN.leadIn;
  const span = WORLD.finishX - graphStartX;

  const ys: number[] = new Array(n);
  ys[0] = probToY(probs[0]);
  for (let i = 1; i < n; i++) {
    ys[i] = probToY(probs[i]);
  }

  // Anchor the terrain so its first point exactly matches the spawn platform height
  const shiftY = WORLD.groundTopY - ys[0];
  for (let i = 0; i < n; i++) {
    ys[i] += shiftY;
  }

  const points: TerrainPoint[] = [];
  const push = (x: number, y: number, p: number) => points.push({ x, y, p });

  const firstY = ys[0];
  push(WORLD.spawnX - TERRAIN.leadIn, firstY, probs[0]);
  push(graphStartX, firstY, probs[0]);
  for (let i = 1; i < n; i++) {
    const normT = tSpan > 0 ? (pts[i].t - minT) / tSpan : i / (n - 1);
    push(graphStartX + span * normT, ys[i], probs[i]);
  }
  const lastY = ys[n - 1];
  push(WORLD.finishX + TERRAIN.runout, lastY, probs[n - 1]);

  const segments: TerrainSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, rising: b.p >= a.p });
  }

  return { points, segments };
}

export function probabilityAt(points: TerrainPoint[], x: number): number {
  if (points.length === 0) return 0.5;
  if (x <= points[0].x) return points[0].p;
  const last = points[points.length - 1];
  if (x >= last.x) return last.p;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const t = (x - a.x) / (b.x - a.x);
  return a.p + (b.p - a.p) * t;
}
