import Phaser from 'phaser';
import { PALETTE, WORLD } from '../constants';
import type { Terrain, TerrainPoint } from '../terrain';

const MONO = 'JetBrains Mono, monospace';
const SURFACE_DROP = 420;

export class TrackRenderer {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private terrain: Terrain | null = null;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics().setDepth(1);
  }

  setTerrain(terrain: Terrain): void {
    this.terrain = terrain;
    for (const label of this.labels) label.destroy();
    this.labels = [];
    for (let x = WORLD.markerSpacing; x <= WORLD.markerMaxX; x += WORLD.markerSpacing) {
      this.labels.push(
        this.scene.add
          .text(x, WORLD.groundTopY + 28, `${Math.round(x / 1000)}K`, {
            fontFamily: MONO,
            fontSize: '11px',
            color: '#7c7f86',
          })
          .setOrigin(0.5, 0)
          .setDepth(1),
      );
    }
  }

  groundYAt(x: number): number {
    const pts = this.terrain?.points;
    if (!pts || pts.length === 0) return WORLD.groundTopY;
    if (x <= pts[0].x) return pts[0].y;
    const last = pts[pts.length - 1];
    if (x >= last.x) return last.y;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const t = (x - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }

  update(): void {
    const gfx = this.gfx;
    gfx.clear();
    const terrain = this.terrain;
    if (!terrain || terrain.segments.length === 0) return;

    const view = this.scene.cameras.main.worldView;
    const left = view.left - 120;
    const right = view.right + 120;

    const startIdx = this.firstIndexAt(left);
    const endIdx = this.firstIndexAt(right);

    const bottom = WORLD.groundTopY + 5000;

    // Faint volume bars in the background
    gfx.fillStyle(0x1a1c20, 0.4);
    const barSpacing = WORLD.tickSpacing * 2;
    const barFrom = Math.max(0, Math.ceil(left / barSpacing) * barSpacing);
    for (let x = barFrom; x <= right; x += barSpacing) {
      const h = 100 + (Math.sin(x * 0.001) * 50 + 50); // pseudo-random height
      gfx.fillRect(x - 10, bottom - h, 20, h);
    }

    gfx.fillStyle(PALETTE.surface, 1);
    gfx.beginPath();
    gfx.moveTo(terrain.points[startIdx].x, terrain.points[startIdx].y);
    for (let i = startIdx + 1; i <= endIdx; i++) {
      gfx.lineTo(terrain.points[i].x, terrain.points[i].y);
    }
    gfx.lineTo(terrain.points[endIdx].x, bottom);
    gfx.lineTo(terrain.points[startIdx].x, bottom);
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(1, PALETTE.tick, 0.8);
    const tickFrom = Math.max(WORLD.tickSpacing, Math.ceil(left / WORLD.tickSpacing) * WORLD.tickSpacing);
    for (let x = tickFrom; x <= right; x += WORLD.tickSpacing) {
      const y = this.groundYAt(x);
      gfx.lineBetween(x, y + 4, x, y + 24);
    }

    for (let i = startIdx; i < endIdx; i++) {
      const seg = terrain.segments[Math.min(i, terrain.segments.length - 1)];
      const color = seg.rising ? PALETTE.toxic : PALETTE.crimson;
      
      // Crisp, sharp high-fidelity line (no chunky glow)
      gfx.lineStyle(4, color, 0.2);
      gfx.lineBetween(seg.ax, seg.ay, seg.bx, seg.by);
      gfx.lineStyle(2, color, 1);
      gfx.lineBetween(seg.ax, seg.ay, seg.bx, seg.by);
    }
  }

  private firstIndexAt(x: number): number {
    const pts = this.terrain!.points;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x < x) lo = mid;
      else hi = mid;
    }
    return lo;
  }
}

export type { TerrainPoint };
