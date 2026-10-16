import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  decodeShareLink,
  driveAtStep,
  driveFromMask,
  encodeShareLink,
  maskFromDrive,
  poseAt,
  type SharePayload,
} from './replay.ts';

function payload(overrides: Partial<SharePayload> = {}): SharePayload {
  return {
    trackId: '2589812-15c71daca061',
    trackHashPrefix: '0123456789abcdef',
    inverted: false,
    interval: 'ALL',
    events: [
      [0, 0],
      [12, 1],
      [40, 17],
      [41, 16],
      [300, 0],
    ],
    endStep: 420,
    outcome: 'crash',
    endX: 5231.5,
    ...overrides,
  };
}

describe('drive mask', () => {
  it('round-trips every bit', () => {
    const drive = {
      gas: true,
      brake: true,
      leanBack: true,
      leanFwd: true,
      nitro: true,
      jump: true,
      burning: true,
    };
    expect(driveFromMask(maskFromDrive(drive))).toEqual(drive);
    expect(maskFromDrive({ ...drive, gas: false })).toBe(0b1111110);
  });

  it('defaults to empty', () => {
    expect(maskFromDrive({ gas: false, brake: false, leanBack: false, leanFwd: false, nitro: false, jump: false, burning: false })).toBe(0);
  });
});

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
  it('round-trips a realistic run', () => {
    const link = encodeShareLink(payload());
    expect(link).not.toMatch(/[+/=]/);
    const back = decodeShareLink(link);
    expect(back.trackId).toBe('2589812-15c71daca061');
    expect(back.trackHashPrefix).toBe('0123456789abcdef');
    expect(back.inverted).toBe(false);
    expect(back.interval).toBe('ALL');
    expect(back.events).toEqual(payload().events);
    expect(back.endStep).toBe(420);
    expect(back.outcome).toBe('crash');
    expect(back.endX).toBe(5231.5);
    expect(back.encodedLength).toBe(link.length);
  });

  it('covers flags, windows and outcomes', () => {
    const link = encodeShareLink(
      payload({ inverted: true, interval: '24H', outcome: 'finish', endStep: 3600, endX: 24000 }),
    );
    const back = decodeShareLink(link);
    expect(back.inverted).toBe(true);
    expect(back.interval).toBe('24H');
    expect(back.outcome).toBe('finish');
  });

  it('stays short for a normal run', () => {
    // ~5 input changes/second for a minute of hard riding.
    const events: Array<[number, number]> = [[0, 0]];
    for (let i = 1; i <= 300; i++) events.push([i * 12, (i * 37) % 128]);
    const link = 'r/' + encodeShareLink(payload({ events, endStep: 3600 }));
    expect(link.length).toBeLessThan(1200);
  });

  it('rejects tampered links loudly', () => {
    const link = encodeShareLink(payload());
    const flip = (s: string, i: number, ch: string) => s.slice(0, i) + ch + s.slice(i + 1);
    expect(() => decodeShareLink(flip(link, 5, link[5] === 'A' ? 'B' : 'A'))).toThrow();
    expect(() => decodeShareLink(link.slice(0, 10))).toThrow();
    expect(() => decodeShareLink(link + 'AAAA')).toThrow();
    expect(() => decodeShareLink('')).toThrow();
    expect(() => decodeShareLink('not-base64!!')).toThrow();
  });

  it('rejects a bad version and bad shapes', () => {
    expect(() => encodeShareLink(payload({ events: [] }))).toThrow(/no input/);
    expect(() => encodeShareLink(payload({ trackId: '../evil' }))).toThrow();
    expect(() => encodeShareLink(payload({ trackHashPrefix: 'xyz' }))).toThrow();
  });
});

describe('driveAtStep', () => {
  it('holds the last event at or before the step', () => {
    const events: Array<[number, number]> = [
      [0, 0],
      [10, 1],
      [20, 17],
    ];
    expect(driveAtStep(events, 0)).toBe(0);
    expect(driveAtStep(events, 9)).toBe(0);
    expect(driveAtStep(events, 10)).toBe(1);
    expect(driveAtStep(events, 10_000)).toBe(17);
  });
});

describe('poseAt', () => {
  const snaps = [
    { t: 0, x: 100, y: 200, a: 0 },
    { t: 100, x: 200, y: 180, a: 0.5 },
    { t: 300, x: 400, y: 100, a: -0.5 },
  ];

  it('interpolates between keyframes', () => {
    expect(poseAt(snaps, 50)).toEqual({ x: 150, y: 190, a: 0.25 });
  });

  it('holds the ends outside the range', () => {
    expect(poseAt(snaps, -10)).toEqual({ x: 100, y: 200, a: 0 });
    expect(poseAt(snaps, 9999)).toEqual({ x: 400, y: 100, a: -0.5 });
  });

  it('returns null with no snapshots', () => {
    expect(poseAt([], 50)).toBeNull();
  });
});
