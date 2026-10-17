import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  decodeShareLink,
  encodeShareLink,
  framesToGhost,
  poseAtStep,
  timeMsAtStep,
  MAX_LINK_LENGTH,
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
    endStep: 600,
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
  it('round-trips a realistic run within quantization', () => {
    const { frames, tricks } = run();
    const link = encodeShareLink(meta(), frames, tricks);
    expect(link).not.toMatch(/[+/=]/);
    const back = decodeShareLink(link);
    expect(back.meta.trackId).toBe('2589812-15c71daca061');
    expect(back.meta.trackHashPrefix).toBe('0123456789abcdef');
    expect(back.meta.beginStep).toBe(24);
    expect(back.meta.endStep).toBe(600);
    expect(back.meta.outcome).toBe('crash');
    expect(back.meta.progress).toBeCloseTo(0.623, 3);
    expect(back.meta.finalScore).toBe(1234);
    expect(back.truncated).toBe(false);
    // Share density is 10 Hz: every 2nd local frame travels.
    expect(back.frames).toHaveLength(100);
    expect(back.tricks).toEqual(tricks);
    // 0.5 px positions, ~0.5 deg angles, worst case.
    const orig = frames[100];
    const round = back.frames[50];
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(orig.c[i] - round.c[i])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(orig.r[i] - round.r[i])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(orig.f[i] - round.f[i])).toBeLessThanOrEqual(0.5);
    }
    expect(Math.abs(orig.c[2] - round.c[2])).toBeLessThanOrEqual(0.01);
  });

  it('covers flags, windows and outcomes', () => {
    const { frames, tricks } = run(20);
    const back = decodeShareLink(encodeShareLink(meta({ inverted: true, interval: '24H', outcome: 'finish' }), frames, tricks));
    expect(back.meta.inverted).toBe(true);
    expect(back.meta.interval).toBe('24H');
    expect(back.meta.outcome).toBe('finish');
  });

  it('keeps normal runs short and truncates marathons with a flag', () => {
    // A minute of hard riding at share density.
    const { frames, tricks } = run(600);
    const link = encodeShareLink(meta(), frames, tricks);
    expect(link.length).toBeLessThan(MAX_LINK_LENGTH);

    // Ten minutes: must truncate to the last 30 s and say so.
    const long: BodyFrame[] = [];
    for (let i = 0; i < 6000; i++) long.push(frame(i * 3));
    const longLink = encodeShareLink(meta(), long, tricks);
    expect(longLink.length).toBeLessThan(MAX_LINK_LENGTH);
    const back = decodeShareLink(longLink);
    expect(back.truncated).toBe(true);
    expect(back.frames.length).toBeLessThanOrEqual(300);
    // Downsampled even indices: last step is 17994, still the run's tail.
    expect(back.frames[back.frames.length - 1].step).toBe(17994);
  });

  it('rejects tampered links loudly', () => {
    const { frames, tricks } = run();
    const link = encodeShareLink(meta(), frames, tricks);
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    expect(() => decodeShareLink(flip(link, 2))).toThrow();
    expect(() => decodeShareLink(flip(link, 5))).toThrow();
    expect(() => decodeShareLink(flip(link, Math.floor(link.length / 2)))).toThrow();
    expect(() => decodeShareLink(link.slice(0, 10))).toThrow();
    expect(() => decodeShareLink(link + 'AAAA')).toThrow();
    expect(() => decodeShareLink('')).toThrow();
    expect(() => decodeShareLink('not-base64!!')).toThrow();
  });

  it('catches every possible single-character flip', () => {
    const { frames, tricks } = run(10);
    const link = encodeShareLink(meta(), frames, tricks);
    for (let i = 0; i < link.length; i++) {
      const flipped = link.slice(0, i) + (link[i] === 'A' ? 'B' : 'A') + link.slice(i + 1);
      expect(() => decodeShareLink(flipped), `flip at ${i}`).toThrow();
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
