/**
 * Largest-Triangle-Three-Buckets downsampling.
 *
 * Replaces the old fixed-stride sampler, which could step straight over the
 * single spike that makes a track interesting. LTTB keeps the first and last
 * points and picks the point per bucket that forms the largest triangle with
 * its neighbours, so cliffs and spikes survive.
 *
 * Pure and deterministic: same input, same output, byte for byte.
 */
import type { PricePoint } from './types.ts';

export function lttb(points: PricePoint[], threshold: number): PricePoint[] {
  if (!Number.isFinite(threshold) || threshold < 3) {
    throw new Error(`lttb threshold must be >= 3 (got ${threshold})`);
  }
  if (points.length <= threshold) return points.slice();

  const sampled: PricePoint[] = [];
  const bucketSize = (points.length - 2) / (threshold - 2);

  sampled.push(points[0]);

  let a = 0; // index of the previously selected point
  for (let i = 0; i < threshold - 2; i++) {
    // Average of the NEXT bucket — the triangle's third vertex.
    const nextStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length);
    let avgX = 0;
    let avgY = 0;
    const nextCount = Math.max(nextEnd - nextStart, 1);
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += points[j].t;
      avgY += points[j].p;
    }
    avgX /= nextCount;
    avgY /= nextCount;

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    const ax = points[a].t;
    const ay = points[a].p;

    let maxArea = -1;
    let chosen = rangeStart;

    for (let j = rangeStart; j < Math.min(rangeEnd, points.length - 1); j++) {
      const area = Math.abs(
        (ax - avgX) * (points[j].p - ay) - (ax - points[j].t) * (avgY - ay),
      );
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }

    sampled.push(points[chosen]);
    a = chosen;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}
