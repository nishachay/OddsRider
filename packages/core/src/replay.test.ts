import { describe, expect, it } from 'vitest';
import {
  ANGLE_QUANT,
  POSITION_QUANT,
  base64UrlDecode,
  base64UrlEncode,
  decodeShareLink,
  encodeShareLink,
  framesToGhost,
  poseAtStep,
  timeMsAtStep,
  MAX_LINK_LENGTH,
  SHARE_DOWNSAMPLE,
  type BodyFrame,
  type RunMeta,
} from './replay.ts';

function frame(step: number, dx = 0): BodyFrame {
  return {
    step,
    c: [850 + step * 2 + dx, 480 - step + dx, 0.05 + step * 0.001],
    r: [794 + step * 2 + dx, 498 - step + dx, step * 0.01],
    f: [906 + step * 2 + dx, 498 - step + dx, step * 0.01],
    ejected: false,
  };
}

function meta(overrides: Partial<RunMeta> = {}): RunMeta {
  return {
    trackId: '2589812-15c71daca061',
    trackHashPrefix: '0123456789abcdef',
    inverted: false,
    interval: 'ALL',
    beginStep: 24,
    endStep: 3540,
    outcome: 'crash',
    progress: 0.623,
    finalScore: 1234,
    finalTimeMs: 9567,
    ...overrides,
  };
}

function run(length = 200): { frames: BodyFrame[]; tricks: Array<{ step: number; code: number; points: number }> } {
  const frames: BodyFrame[] = [];
  for (let i = 0; i < length; i++) frames.push(frame(i * 3));
  return {
    frames,
    tricks: [
      { step: 120, code: 1, points: 500 },
      { step: 300, code: 3, points: 200 },
    ],
  };
}

// A realistic 60-second ride sampled at 20 Hz (1200 body poses), the size the
// share codec must keep under 8 KB.
function minuteRun(): BodyFrame[] {
  const frames: BodyFrame[] = [];
  for (let i = 0; i < 1200; i++) {
    const step = i * 3;
    const x = 800 + i * 20 + Math.sin(i * 0.05) * 6;
    const y = 470 + Math.sin(i * 0.07) * 55 + Math.cos(i * 0.013) * 12;
    const a = Math.sin(i * 0.045) * 0.32;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    frames.push({
      step,
      c: [x, y, a],
      r: [x + cos * -56 - sin * 18, y + sin * -56 + cos * 18, a + i * 0.02],
      f: [x + cos * 56 - sin * 18, y + sin * 56 + cos * 18, a + i * 0.02],
      ejected: false,
    });
  }
  return frames;
}

// Marathon data for the truncation path: a 0.5 px / ~1/256 rad random walk has
// short varints but no structure for deflate to exploit, so a long run really
// does pass the link cap.
function marathonRun(count: number): BodyFrame[] {
  let seed = 0x1f123bb5;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const frames: BodyFrame[] = [];
  let x = 800;
  let y = 470;
  let a = 0;
  for (let i = 0; i < count; i++) {
    x += Math.round((rand() * 2 - 1) * 60) / 2;
    y += Math.round((rand() * 2 - 1) * 60) / 2;
    a += Math.round((rand() * 2 - 1) * 60) / 256;
    frames.push({
      step: i * 3,
      c: [x, y, a],
      r: [x - 56, y + 18, a],
      f: [x + 56, y + 18, a],
      ejected: false,
    });
  }
  return frames;
}

describe('base64url', () => {
  it('round-trips arbitrary bytes with no padding or unsafe chars', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 200, 255, 16, 32, 48]);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(base64UrlDecode(text)).toEqual(bytes);
  });

  it('rejects garbage', () => {
    expect(() => base64UrlDecode('!!!')).toThrow();
    expect(() => base64UrlDecode('abc$')).toThrow();
  });
});

describe('share link codec', () => {
  it('round-trips a realistic run within quantization error', () => {
    const { frames, tricks } = run();
    const link = encodeShareLink(meta(), frames, tricks);
    expect(link).not.toMatch(/[+/=]/);
    const back = decodeShareLink(link);
    expect(back.meta.trackId).toBe('2589812-15c71daca061');
    expect(back.meta.trackHashPrefix).toBe('0123456789abcdef');
    expect(back.meta.beginStep).toBe(24);
    expect(back.meta.endStep).toBe(3540);
    expect(back.meta.outcome).toBe('crash');
    expect(back.meta.progress).toBeCloseTo(0.623, 3);
    expect(back.meta.finalScore).toBe(1234);
    expect(back.truncated).toBe(false);
    // Share density is 10 Hz: every 2nd local (20 Hz) frame travels.
    expect(back.frames).toHaveLength(100);
    expect(back.tricks).toEqual(tricks);
    // Every decoded value lands within its quantization step of the source.
    const posStep = 1 / POSITION_QUANT;
    const angStep = 1 / ANGLE_QUANT;
    for (let k = 0; k < back.frames.length; k++) {
      const orig = frames[k * 2];
      const round = back.frames[k];
      expect(round.step).toBe(orig.step);
      for (const key of ['c', 'r', 'f'] as const) {
        expect(Math.abs(orig[key][0] - round[key][0])).toBeLessThanOrEqual(posStep);
        expect(Math.abs(orig[key][1] - round[key][1])).toBeLessThanOrEqual(posStep);
        expect(Math.abs(orig[key][2] - round[key][2])).toBeLessThanOrEqual(angStep);
      }
    }
  });

  it('keeps a 60-second run under 8 KB', () => {
    const frames = minuteRun();
    expect(frames).toHaveLength(1200);
    const link = encodeShareLink(meta({ endStep: 3597, finalTimeMs: 60_000 }), frames, []);
    expect(link.length).toBeLessThan(8192);
    const back = decodeShareLink(link);
    expect(back.truncated).toBe(false);
    expect(back.frames).toHaveLength(600);
  });

  it('covers flags, windows and outcomes', () => {
    const { frames, tricks } = run(20);
    const back = decodeShareLink(
      encodeShareLink(meta({ inverted: true, interval: '24H', outcome: 'finish' }), frames, tricks),
    );
    expect(back.meta.inverted).toBe(true);
    expect(back.meta.interval).toBe('24H');
    expect(back.meta.outcome).toBe('finish');
  });

  it('carries ejected ragdoll poses', () => {
    const { frames } = run(6);
    const crashed = frames.map((f, i) =>
      i >= 3 ? { ...f, ejected: true, g: [1000 + i, 500 - i, 0.4] as [number, number, number] } : f,
    );
    const back = decodeShareLink(encodeShareLink(meta(), crashed, []));
    // Share density drops every other snapshot, so 6 local poses travel as 3.
    const sampled = crashed.filter((_, i) => i % SHARE_DOWNSAMPLE === 0);
    expect(back.frames).toHaveLength(sampled.length);
    expect(back.frames[0].ejected).toBe(false);
    const ejected = back.frames[back.frames.length - 1];
    const source = sampled[sampled.length - 1];
    expect(ejected.ejected).toBe(true);
    expect(ejected.g![0]).toBeCloseTo(source.g![0], 1);
    expect(ejected.g![1]).toBeCloseTo(source.g![1], 1);
    expect(ejected.g![2]).toBeCloseTo(source.g![2], 1);
  });

  it('truncates marathons to the tail with a flag', () => {
    const long = marathonRun(6000);
    const longLink = encodeShareLink(meta(), long, []);
    expect(longLink.length).toBeLessThan(MAX_LINK_LENGTH);
    const back = decodeShareLink(longLink);
    expect(back.truncated).toBe(true);
    expect(back.frames.length).toBeLessThan(long.length);
    // The tail is kept: the last decoded frame is the run's last sampled pose.
    const sampled = long.filter((_, i) => i % SHARE_DOWNSAMPLE === 0);
    const source = sampled[sampled.length - 1];
    const last = back.frames[back.frames.length - 1];
    expect(last.step).toBe(source.step);
    expect(last.c[0]).toBeCloseTo(source.c[0], 1);
    expect(back.frames[0].step).toBeGreaterThan(0);
  });

  it('rejects tampered or malformed links loudly', () => {
    const { frames, tricks } = run();
    const link = encodeShareLink(meta(), frames, tricks);
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    expect(() => decodeShareLink(link.slice(0, 10))).toThrow();
    expect(() => decodeShareLink(link + 'AAAA')).toThrow();
    expect(() => decodeShareLink('')).toThrow();
    expect(() => decodeShareLink('not-base64!!')).toThrow();
    for (const i of [2, 5, Math.floor(link.length / 2), link.length - 2]) {
      expect(() => decodeShareLink(flip(link, i)), `flip at ${i}`).toThrow();
    }
  });

  it('rejects oversized links', () => {
    expect(() => decodeShareLink('A'.repeat(MAX_LINK_LENGTH * 2 + 1))).toThrow(/length/);
  });

  it('rejects bad shapes at encode time', () => {
    const { frames, tricks } = run(10);
    expect(() => encodeShareLink(meta(), [], tricks)).toThrow(/no frames/);
    expect(() => encodeShareLink(meta({ trackId: '../evil' }), frames, tricks)).toThrow();
    expect(() => encodeShareLink(meta({ trackHashPrefix: 'xyz' }), frames, tricks)).toThrow();
  });
});

describe('poseAtStep', () => {
  it('interpolates between frames', () => {
    const { frames } = run(10);
    const mid = poseAtStep(frames, frames[4].step + 1);
    expect(mid).not.toBeNull();
    expect(mid!.c[0]).toBeGreaterThan(frames[4].c[0]);
    expect(mid!.c[0]).toBeLessThan(frames[5].c[0]);
  });

  it('holds the ends outside the range', () => {
    const { frames } = run(10);
    expect(poseAtStep(frames, -5)?.c[0]).toBe(frames[0].c[0]);
    expect(poseAtStep(frames, 99999)?.c[0]).toBe(frames[frames.length - 1].c[0]);
  });

  it('returns null with no frames', () => {
    expect(poseAtStep([], 10)).toBeNull();
  });

  it('carries the ejected flag from the nearer keyframe', () => {
    const { frames } = run(10);
    const crashed = frames.map((f) => ({ ...f, ejected: f.step >= 15 }));
    expect(poseAtStep(crashed, 16)?.ejected).toBe(true);
    expect(poseAtStep(crashed, 13)?.ejected).toBe(false);
  });
});

describe('timeMsAtStep', () => {
  it('derives score time from the begin step', () => {
    expect(timeMsAtStep(0, -1)).toBe(0);
    expect(timeMsAtStep(10, -1)).toBe(0);
    expect(timeMsAtStep(23, 24)).toBe(0);
    expect(timeMsAtStep(24, 24)).toBe(17);
    expect(timeMsAtStep(83, 24)).toBe(1000);
  });
});

describe('framesToGhost', () => {
  it('converts rear-hub poses with derived times', () => {
    const { frames } = run(10);
    const ghosts = framesToGhost(frames, 24);
    expect(ghosts).toHaveLength(frames.length);
    expect(ghosts[0].x).toBe(frames[0].r[0]);
    expect(ghosts[0].t).toBe(timeMsAtStep(frames[0].step, 24));
  });
});
